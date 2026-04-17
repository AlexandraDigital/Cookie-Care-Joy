// functions/send-push.js
// POST /send-push — sends a Web Push notification to a stored subscription
// Body: { endpoint, title, body }
// Called by a Cloudflare Cron Trigger (or directly from schedule.js)

const VAPID_PUBLIC  = "BAS4G2cNqgLqZQl896xIGmCHdwsWqVmteQ8zUrf8zU5x_3mVg7SE6IfjzBZI4WPWeivdXsHrV6njLcqceAoyZSA";
const VAPID_PRIVATE = "toR6Lda2f-DpgmAi44X47YTxUnP3u3-xK-n4fXsy5rs";
const VAPID_SUBJECT = "mailto:admin@cookie-care-joy.pages.dev";

// ── VAPID JWT helpers ─────────────────────────────────────────────────────────

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function base64urlEncode(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function makeVapidJWT(audience) {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const sigInput = `${header}.${payload}`;
  const keyData = base64urlDecode(VAPID_PRIVATE);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    toPkcs8(keyData),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(sigInput)
  );
  return `${sigInput}.${base64urlEncode(sig)}`;
}

// Wrap raw 32-byte private key in PKCS#8 DER envelope for WebCrypto
function toPkcs8(rawKey) {
  // PKCS#8 wrapper for P-256 private key
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00, 0x04,
  ]);
  // We need the public key bytes too — derive from private via subtle or use stored public key
  const pubKeyBytes = base64urlDecode(VAPID_PUBLIC).slice(1); // strip 0x04 prefix
  const combined = new Uint8Array(prefix.length + rawKey.length + suffix.length + pubKeyBytes.length);
  combined.set(prefix, 0);
  combined.set(rawKey, prefix.length);
  combined.set(suffix, prefix.length + rawKey.length);
  combined.set(pubKeyBytes, prefix.length + rawKey.length + suffix.length);
  return combined.buffer;
}

// ── Encrypt payload using Web Push encryption (RFC 8291 / HKDF + AES-GCM) ───

async function encryptPayload(subscription, payload) {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));

  // Generate local (sender) ECDH key pair
  const senderKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const senderPublicKey = await crypto.subtle.exportKey("raw", senderKeys.publicKey);

  // Import recipient (browser) public key
  const recipientPublicKey = await crypto.subtle.importKey(
    "raw",
    base64urlDecode(subscription.keys.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientPublicKey },
    senderKeys.privateKey,
    256
  );

  const authSecret = base64urlDecode(subscription.keys.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive content encryption key and nonce
  const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);

  // PRK (pseudorandom key)
  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: buildInfo("auth", new Uint8Array(), new Uint8Array()) },
    hkdfKey, 256
  );

  const senderPubBytes = new Uint8Array(senderPublicKey);
  const recipientPubBytes = base64urlDecode(subscription.keys.p256dh);

  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  const contentEncKey = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: buildInfo("aesgcm", recipientPubBytes, senderPubBytes) },
    prkKey, 128
  );
  const nonce = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: buildInfo("nonce", recipientPubBytes, senderPubBytes) },
    prkKey, 96
  );

  const aesKey = await crypto.subtle.importKey("raw", contentEncKey, "AES-GCM", false, ["encrypt"]);

  // Pad plaintext: 2-byte length prefix + 0 padding
  const padded = new Uint8Array(2 + plaintext.length);
  padded[0] = 0;
  padded[1] = 0;
  padded.set(plaintext, 2);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    padded
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    salt,
    senderPublicKey: senderPubBytes,
  };
}

function buildInfo(type, recipientPublicKey, senderPublicKey) {
  const encoder = new TextEncoder();
  if (type === "auth") {
    return encoder.encode("Content-Encoding: auth\0");
  }
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\0`);
  const p256bytes = encoder.encode("P-256\0");
  const info = new Uint8Array(
    typeBytes.length + p256bytes.length + 2 + recipientPublicKey.length + 2 + senderPublicKey.length
  );
  let offset = 0;
  info.set(typeBytes, offset); offset += typeBytes.length;
  info.set(p256bytes, offset); offset += p256bytes.length;
  info[offset++] = 0; info[offset++] = recipientPublicKey.length;
  info.set(recipientPublicKey, offset); offset += recipientPublicKey.length;
  info[offset++] = 0; info[offset++] = senderPublicKey.length;
  info.set(senderPublicKey, offset);
  return info;
}

// ── Send a single Web Push notification ──────────────────────────────────────

export async function sendPush(subscription, title, body) {
  const endpoint = subscription.endpoint;
  const origin = new URL(endpoint).origin;
  const jwt = await makeVapidJWT(origin);

  const { ciphertext, salt, senderPublicKey } = await encryptPayload(subscription, { title, body });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${base64urlEncode(salt)}`,
      "Crypto-Key": `dh=${base64urlEncode(senderPublicKey)};p256ecdsa=${VAPID_PUBLIC}`,
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      "TTL": "86400",
    },
    body: ciphertext,
  });

  return response;
}

// ── Pages Function handler ────────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  try {
    const { endpoint, title, body } = await request.json();
    if (!endpoint) return json({ error: "No endpoint" }, 400);

    const key = "sub_" + btoa(endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
    const stored = await env.CCJ_SUBS.get(key);
    if (!stored) return json({ error: "Subscription not found" }, 404);

    const subscription = JSON.parse(stored);
    const resp = await sendPush(subscription, title || "Cookie-Care-Joy 🍪", body || "Time to take care of yourself ✨");

    if (resp.status === 410 || resp.status === 404) {
      // Subscription expired — clean up
      await env.CCJ_SUBS.delete(key);
      return json({ ok: false, expired: true });
    }

    return json({ ok: resp.ok, status: resp.status });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
