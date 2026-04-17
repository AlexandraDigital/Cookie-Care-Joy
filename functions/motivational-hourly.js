// functions/motivational-hourly.js
// Cloudflare Cron Trigger: Every hour (0 * * * *)
// Sends a random sweet motivational message to all subscribed users

const VAPID_PUBLIC  = "BAS4G2cNqgLqZQl896xIGmCHdwsWqVmteQ8zUrf8zU5x_3mVg7SE6IfjzBZI4WPWeivdXsHrV6njLcqceAoyZSA";
const VAPID_PRIVATE = "toR6Lda2f-DpgmAi44X47YTxUnP3u3-xK-n4fXsy5rs";
const VAPID_SUBJECT = "mailto:admin@cookie-care-joy.pages.dev";

const MOTIVATIONAL_MESSAGES = [
  { title: "🍪 You're Amazing!", body: "Every bit of care you give matters more than you know." },
  { title: "💕 Be Kind to Yourself", body: "Taking care of yourself isn't selfish—it's essential. You deserve it." },
  { title: "✨ You've Got This!", body: "One day at a time, one moment at a time. That's all you need." },
  { title: "🌟 Be Proud Today", body: "You're trying, and that's what counts." },
  { title: "💪 Tough Days Happen", body: "But you're still worthy, still capable, still enough." },
  { title: "🎯 Progress is Real", body: "It's not always visible, but it's always happening. Trust the journey." },
  { title: "💖 You're Braver", body: "Braver than you believe, stronger than you seem. Keep going!" },
  { title: "🌈 You Matter", body: "The fact that you're here, trying, speaks volumes about your character." },
  { title: "🫂 You Are Enough", body: "You don't have to be perfect to be valuable. You are enough as you are." },
  { title: "✨ Small Steps Count", body: "Small steps still move you forward. Celebrate the little wins today!" },
  { title: "💫 You're Shining", body: "Your effort matters, even when no one's watching. Keep shining." },
  { title: "🌻 Fresh Start Tomorrow", body: "Tomorrow is a new chance to be kind to yourself. You've got this." },
  { title: "💝 Give Yourself Credit", body: "You're doing better than you think." },
  { title: "🎨 Find Your Joy", body: "Life is about the little moments of joy. You're creating those moments." },
  { title: "🚀 You're Not Stuck", body: "You're not as stuck as you feel. Every breath is a fresh start." },
  { title: "❤️ Start With Kindness", body: "Your kindness to others starts with being kind to yourself." },
  { title: "🌙 You Show Up", body: "Even on the hardest days, you show up. That's the spirit of a champion." },
  { title: "💎 You're Precious", body: "You're precious, you're valued, and your presence matters." },
  { title: "🎪 Spread Joy", body: "Spread joy like cookies—freely, warmly, and with love. That's you!" },
  { title: "🌟 Beautiful Growth", body: "You're a work in progress, and that's the most beautiful thing about you." },
  { title: "🔥 You Can Do This", body: "You've already overcome so much. This challenge? You've got it." },
  { title: "🌺 You're a Gift", body: "Your presence alone is a gift to those around you." },
  { title: "💝 Be Gentle", body: "Be gentle with yourself. You're doing the best you can." },
  { title: "🌤️ Rest Without Guilt", body: "It's okay to rest. You don't have to earn your worth." },
  { title: "✨ Self-Care is Love", body: "Every moment of self-care is an act of love." },
  { title: "🦋 You're Growing", body: "You're growing, changing, becoming—and that's beautiful." },
  { title: "💞 Your Strength", body: "Your struggles don't define you. Your strength does." },
  { title: "🌸 You Matter", body: "You're allowed to take up space. You matter." },
  { title: "🎵 Enjoy the Journey", body: "Life's a journey, not a race. Enjoy the path you're on." },
  { title: "🌊 Flow With Grace", body: "Flow with grace. You're exactly where you need to be." },
  { title: "🏆 You're Stronger", body: "You're stronger than your doubts. Believe in yourself." },
  { title: "🌟 Write Your Story", body: "Today's a new story. Write it with kindness to yourself." },
  { title: "💫 Your Dreams Matter", body: "Your dreams are worth pursuing, and so are you." },
  { title: "🎀 Treat Yourself Well", body: "Treat yourself like you'd treat your best friend." },
  { title: "🌹 Forever Growing", body: "You're allowed to be a work in progress forever. Growth is love." },
  { title: "💪 Say Yes to You", body: "Every 'no' to others is a 'yes' to your wellbeing." },
  { title: "🎯 Learning is Wisdom", body: "You're not failing—you're learning. That's wisdom." },
  { title: "✨ Trust Yourself", body: "Your heart is in the right place. Trust yourself." },
  { title: "🌈 Celebrate You!", body: "Life's too short not to celebrate you. You're amazing!" },
  { title: "💝 Just Breathe", body: "Breathe. You're doing just fine." },
  { title: "🦋 Your Own Pace", body: "Transform at your own pace. There's no deadline on growth." },
  { title: "🌸 Guilt-Free Rest", body: "You deserve rest without guilt. You've earned it." },
  { title: "💫 Light is Coming", body: "Darkness passes. Light is coming. You'll see." },
  { title: "🎪 Dance Through Life", body: "Dance through life, even on tough days." },
  { title: "🌟 Your Story Matters", body: "Your story matters. So do you." },
  { title: "💕 Embrace Softness", body: "Let yourself be soft. Softness is strength." },
  { title: "🌺 Bloom at Your Pace", body: "You're blooming at your own beautiful pace." },
  { title: "🔮 Trust the Timing", body: "Trust the timing of your life. It's perfect." },
  { title: "✨ You're a Masterpiece", body: "You're a masterpiece in progress. Keep creating." },
  { title: "🎨 Color Your World", body: "Color your world with your own joy. You deserve it." },
  { title: "💖 Love Over Fear", body: "Every moment you choose love over fear counts." },
];

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
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const sigInput = `${header}.${payload}`;
  const rawKey = base64urlDecode(VAPID_PRIVATE);
  const pubBytes = base64urlDecode(VAPID_PUBLIC).slice(1);
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const suffix = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00, 0x04]);
  const pkcs8 = new Uint8Array(prefix.length + rawKey.length + suffix.length + pubBytes.length);
  pkcs8.set(prefix);
  pkcs8.set(rawKey, prefix.length);
  pkcs8.set(suffix, prefix.length + rawKey.length);
  pkcs8.set(pubBytes, prefix.length + rawKey.length + suffix.length);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
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
  out.set(t, o); o += t.length;
  out.set(p, o); o += p.length;
  out[o++] = 0; out[o++] = rec.length;
  out.set(rec, o); o += rec.length;
  out[o++] = 0; out[o++] = sen.length;
  out.set(sen, o);
  return out;
}

async function encryptPayload(subscription, payload) {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const senderKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const senderPublicKey = await crypto.subtle.exportKey("raw", senderKeys.publicKey);
  const recipientPublicKey = await crypto.subtle.importKey(
    "raw",
    base64urlDecode(subscription.keys.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedSecret = await crypto.subtle.deriveBits({ name: "ECDH", public: recipientPublicKey }, senderKeys.privateKey, 256);
  const authSecret = base64urlDecode(subscription.keys.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: buildInfo("auth", [], []) },
    hkdfKey,
    256
  );
  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);
  const recPub = base64urlDecode(subscription.keys.p256dh);
  const senPub = new Uint8Array(senderPublicKey);
  const cek = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: buildInfo("aesgcm", recPub, senPub) },
    prkKey,
    128
  );
  const nonceBytes = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: buildInfo("nonce", recPub, senPub) },
    prkKey,
    96
  );
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const padded = new Uint8Array(2 + plaintext.length);
  padded.set(plaintext, 2);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBytes }, aesKey, padded);
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

// ── Cron handler ──────────────────────────────────────────────────────────────
// Runs every hour. Sends a random motivational message to all subscriptions.

export async function onScheduled({ env, cron }) {
  try {
    const message = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
    const now = Date.now();
    let sent = 0;
    let failed = 0;
    let cursor;

    do {
      const listOpts = { prefix: "sub_", limit: 100 };
      if (cursor) listOpts.cursor = cursor;
      const list = await env.CCJ_SUBS.list(listOpts);

      for (const { name } of list.keys) {
        const raw = await env.CCJ_SUBS.get(name);
        if (!raw) continue;

        try {
          const subscription = JSON.parse(raw);
          const resp = await sendPush(subscription, message.title, message.body);

          if (resp.status === 410 || resp.status === 404) {
            // Subscription expired — clean up
            await env.CCJ_SUBS.delete(name);
            failed++;
          } else if (resp.ok) {
            sent++;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        }
      }

      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    console.log(`[Motivational Message Cron] Sent: ${sent}, Failed: ${failed}, Message: "${message.title}"`);
  } catch (e) {
    console.error("[Motivational Message Cron] Error:", e.message);
  }
}
