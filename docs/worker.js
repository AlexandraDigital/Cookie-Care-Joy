// Cookie-Care-Joy Notification Worker
// Cloudflare Worker — store your OneSignal REST API key as env var: ONESIGNAL_API_KEY
// Endpoints:
//   POST /        → send a single welcome push  { playerId, idType? }
//   POST /push    → send one push notification  { playerId, idType?, title, body, sendAfterMs? }
//   POST /schedule → send a batch of notifications (throttled, no rate-limit) { playerId, idType?, messages: [{title, body, sendAfterMs}] }

const ONESIGNAL_APP_ID = "fc237358-e343-4a93-adfe-b22527bb0aef";
const OS_BASE = "https://onesignal.com/api/v1/notifications";
const THROTTLE_MS = 120; // ms between each API call to stay under rate limits

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function targeting(playerId, idType) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId);
  if (idType === "onesignal_id") {
    return { include_aliases: { onesignal_id: [playerId] }, target_channel: "push" };
  } else if (idType === "subscription_id" || isUUID) {
    return { include_subscription_ids: [playerId] };
  } else {
    return { include_player_ids: [playerId] };
  }
}

async function sendPush(playerId, idType, title, body, sendAfterMs, apiKey) {
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    ...targeting(playerId, idType),
    headings: { en: title },
    contents: { en: body },
    android_channel_id: "ccj_reminders",
    android_accent_color: "fff43f6e",
    android_visibility: 1,
    priority: 10,
    ios_sound: "default",
    android_sound: "default",
    chrome_web_icon: "https://alexandradigital.github.io/Cookie-Care-Joy/icon-192.png",
    firefox_icon: "https://alexandradigital.github.io/Cookie-Care-Joy/icon-192.png",
    chrome_web_badge: "https://alexandradigital.github.io/Cookie-Care-Joy/icon-96.png",
    web_url: "https://alexandradigital.github.io/Cookie-Care-Joy/",
    app_url: "https://alexandradigital.github.io/Cookie-Care-Joy/",
  };
  if (sendAfterMs && sendAfterMs > 0) {
    payload.send_after = new Date(Date.now() + sendAfterMs).toISOString();
  }
  const resp = await fetch(OS_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${apiKey}`,   // ✅ Fixed: was "Basic", must be "Key"
    },
    body: JSON.stringify(payload),
  });
  return { status: resp.status, data: await resp.json() };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const apiKey = env.ONESIGNAL_API_KEY;

    let body;
    try { body = await request.json(); } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { playerId, idType = "player_id" } = body;
    if (!playerId) return json({ error: "Missing playerId" }, 400);

    // ── POST / → welcome push ─────────────────────────────────────────────
    if (url.pathname === "/" || url.pathname === "") {
      const result = await sendPush(
        playerId, idType,
        "🍪 Welcome to Cookie-Care-Joy!",
        "Sweet reminders are set — we'll check in on you 💕",
        0,
        apiKey
      );
      return json(result.data, result.status);
    }

    // ── POST /push → single push ──────────────────────────────────────────
    if (url.pathname === "/push") {
      const { title, body: msgBody, sendAfterMs = 0 } = body;
      if (!title || !msgBody) return json({ error: "Missing title or body" }, 400);
      const result = await sendPush(playerId, idType, title, msgBody, sendAfterMs, apiKey);
      return json(result.data, result.status);
    }

    // ── POST /schedule → throttled batch ─────────────────────────────────
    if (url.pathname === "/schedule") {
      const { messages } = body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return json({ error: "Missing or empty messages array" }, 400);
      }

      const results = [];
      let failed = 0;

      for (let i = 0; i < messages.length; i++) {
        const { title, body: msgBody, sendAfterMs = 0 } = messages[i];
        try {
          const result = await sendPush(playerId, idType, title, msgBody, sendAfterMs, apiKey);
          results.push({ index: i, status: result.status, ok: result.status < 300 });
          if (result.status >= 300) failed++;
        } catch (e) {
          results.push({ index: i, error: e.message });
          failed++;
        }
        // Throttle to avoid OneSignal rate limits
        if (i < messages.length - 1) await sleep(THROTTLE_MS);
      }

      return json({ scheduled: messages.length, failed, results });
    }

    return json({ error: "Not found" }, 404);
  }
};
