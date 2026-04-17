// functions/schedule.js
// POST /schedule — stores a batch of scheduled pushes in KV
// Body: { endpoint, messages: [{ title, body, sendAfterMs }] }
// Cron Trigger fires every 30 min to dispatch due messages

// ── VAPID / push helpers (inlined — Pages Functions can't share modules) ──────

const VAPID_PUBLIC  = "BAS4G2cNqgLqZQl896xIGmCHdwsWqVmteQ8zUrf8zU5x_3mVg7SE6IfjzBZI4WPWeivdXsHrV6njLcqceAoyZSA";
const VAPID_PRIVATE = "toR6Lda2f-DpgmAi44X47YTxUnP3u3-xK-n4fXsy5rs";
const VAPID_SUBJECT = "mailto:admin@cookie-care-joy.pages.dev";

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
function base64urlEncode(buf) {
  let str = "";
  for (const b of new Uint8Array(buf)) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function makeVapidJWT(audience) {
  const header  = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT,
  })));
  const sigInput = `${header}.${payload}`;
  const rawKey  = base64urlDecode(VAPID_PRIVATE);
  const pubBytes = base64urlDecode(VAPID_PUBLIC).slice(1);
  const prefix = new Uint8Array([
    0x30,0x81,0x87,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,
    0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x6d,0x30,0x6b,0x02,
    0x01,0x01,0x04,0x20,
  ]);
  const suffix = new Uint8Array([0xa1,0x44,0x03,0x42,0x00,0x04]);
  const pkcs8 = new Uint8Array(prefix.length + rawKey.length + suffix.length + pubBytes.length);
  pkcs8.set(prefix); pkcs8.set(rawKey, prefix.length);
  pkcs8.set(suffix, prefix.length + rawKey.length);
  pkcs8.set(pubBytes, prefix.length + rawKey.length + suffix.length);
  const key = await crypto.subtle.importKey(
    "pkcs8", pkcs8.buffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(sigInput));
  return `${sigInput}.${base64urlEncode(sig)}`;
}
function buildInfo(type, rec, sen) {
  const enc = new TextEncoder();
  if (type === "auth") return enc.encode("Content-Encoding: auth\0");
  const t = enc.encode(`Content-Encoding: ${type}\0`);
  const p = enc.encode("P-256\0");
  const out = new Uint8Array(t.length + p.length + 2 + rec.length + 2 + sen.length);
  let o = 0;
  out.set(t,o); o+=t.length; out.set(p,o); o+=p.length;
  out[o++]=0; out[o++]=rec.length; out.set(rec,o); o+=rec.length;
  out[o++]=0; out[o++]=sen.length; out.set(sen,o);
  return out;
}
async function encryptPayload(subscription, payload) {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const senderKeys = await crypto.subtle.generateKey({ name:"ECDH", namedCurve:"P-256" }, true, ["deriveKey","deriveBits"]);
  const senderPublicKey = await crypto.subtle.exportKey("raw", senderKeys.publicKey);
  const recipientPublicKey = await crypto.subtle.importKey(
    "raw", base64urlDecode(subscription.keys.p256dh), { name:"ECDH", namedCurve:"P-256" }, false, []
  );
  const sharedSecret = await crypto.subtle.deriveBits({ name:"ECDH", public:recipientPublicKey }, senderKeys.privateKey, 256);
  const authSecret = base64urlDecode(subscription.keys.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  const prk = await crypto.subtle.deriveBits(
    { name:"HKDF", hash:"SHA-256", salt:authSecret, info:buildInfo("auth",[],[]) }, hkdfKey, 256
  );
  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);
  const recPub = base64urlDecode(subscription.keys.p256dh);
  const senPub = new Uint8Array(senderPublicKey);
  const cek = await crypto.subtle.deriveBits({ name:"HKDF", hash:"SHA-256", salt, info:buildInfo("aesgcm",recPub,senPub) }, prkKey, 128);
  const nonceBytes = await crypto.subtle.deriveBits({ name:"HKDF", hash:"SHA-256", salt, info:buildInfo("nonce",recPub,senPub) }, prkKey, 96);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const padded = new Uint8Array(2 + plaintext.length);
  padded.set(plaintext, 2);
  const ciphertext = await crypto.subtle.encrypt({ name:"AES-GCM", iv:nonceBytes }, aesKey, padded);
  return { ciphertext: new Uint8Array(ciphertext), salt, senderPublicKey: senPub };
}
async function sendPush(subscription, title, body) {
  const origin = new URL(subscription.endpoint).origin;
  const jwt = await makeVapidJWT(origin);
  const { ciphertext, salt, senderPublicKey } = await encryptPayload(subscription, { title, body });
  return fetch(subscription.endpoint, {
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
}

// ── POST /schedule ────────────────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  try {
    const { endpoint, messages } = await request.json();
    if (!endpoint || !Array.isArray(messages)) {
      return json({ error: "Invalid request" }, 400);
    }
    const subKey = "sub_" + btoa(endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
    const stored = await env.CCJ_SUBS.get(subKey);
    if (!stored) return json({ error: "Subscription not found — subscribe first" }, 404);

    const now = Date.now();
    let scheduled = 0;
    for (const msg of messages) {
      const fireAt = now + (msg.sendAfterMs || 0);
      const schedKey = `sched_${subKey}_${fireAt}`;
      await env.CCJ_SUBS.put(schedKey, JSON.stringify({
        endpoint,
        title: msg.title || "Cookie-Care-Joy 🍪",
        body:  msg.body  || "",
        fireAt,
      }), {
        expirationTtl: Math.ceil(((msg.sendAfterMs || 0) + 60 * 60 * 1000) / 1000),
      });
      scheduled++;
    }
    return json({ ok: true, scheduled });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── Cron handler ──────────────────────────────────────────────────────────────
// Cloudflare Pages cron export MUST be named `onScheduled`.
// wrangler.toml: [triggers] crons = ["*/30 * * * *"]

export async function onScheduled({ env }) {
  const now = Date.now();
  let cursor;
  do {
    const listOpts = { prefix: "sched_", limit: 1000 };
    if (cursor) listOpts.cursor = cursor;
    const list = await env.CCJ_SUBS.list(listOpts);

    for (const { name } of list.keys) {
      const raw = await env.CCJ_SUBS.get(name);
      if (!raw) continue;
      let item;
      try { item = JSON.parse(raw); } catch { continue; }
      if (item.fireAt > now + 30 * 1000) continue;

      const subKey = "sub_" + btoa(item.endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
      const stored = await env.CCJ_SUBS.get(subKey);
      if (!stored) { await env.CCJ_SUBS.delete(name); continue; }

      try {
        const resp = await sendPush(JSON.parse(stored), item.title, item.body);
        if (resp.status === 410 || resp.status === 404) {
          await env.CCJ_SUBS.delete(subKey);
        }
      } catch (_) {}
      await env.CCJ_SUBS.delete(name);
    }

    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
}

// ── CORS preflight ────────────────────────────────────────────────────────────

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
