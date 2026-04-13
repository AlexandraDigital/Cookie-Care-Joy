// functions/schedule.js
// POST /schedule — stores a batch of scheduled pushes in KV
// Body: { endpoint, messages: [{ title, body, sendAfterMs }] }
// A Cron Trigger on the Worker fires /cron every 30 min to dispatch due messages

import { sendPush } from "./send-push.js";

export async function onRequestPost({ request, env }) {
  try {
    const { endpoint, messages } = await request.json();
    if (!endpoint || !Array.isArray(messages)) {
      return json({ error: "Invalid request" }, 400);
    }

    // Look up stored subscription
    const subKey = "sub_" + btoa(endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
    const stored = await env.CCJ_SUBS.get(subKey);
    if (!stored) return json({ error: "Subscription not found — subscribe first" }, 404);

    const now = Date.now();
    let scheduled = 0;

    // Store each message with its fire timestamp
    for (const msg of messages) {
      const fireAt = now + (msg.sendAfterMs || 0);
      const schedKey = `sched_${subKey}_${fireAt}`;
      await env.CCJ_SUBS.put(schedKey, JSON.stringify({
        endpoint,
        title: msg.title || "Cookie-Care-Joy 🍪",
        body: msg.body || "",
        fireAt,
      }), {
        expirationTtl: Math.ceil(((msg.sendAfterMs || 0) + 60 * 60 * 1000) / 1000), // expire 1h after fire time
      });
      scheduled++;
    }

    return json({ ok: true, scheduled });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── Cron handler — fires every 30 minutes via wrangler.toml cron trigger ─────
// Lists all sched_* keys and sends any that are due
export async function onScheduled({ env }) {
  const now = Date.now();
  const list = await env.CCJ_SUBS.list({ prefix: "sched_" });

  for (const { name } of list.keys) {
    const raw = await env.CCJ_SUBS.get(name);
    if (!raw) continue;
    let item;
    try { item = JSON.parse(raw); } catch { continue; }

    if (item.fireAt > now + 30 * 1000) continue; // not due yet (30s buffer)

    // Look up subscription
    const subKey = "sub_" + btoa(item.endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
    const stored = await env.CCJ_SUBS.get(subKey);
    if (!stored) {
      await env.CCJ_SUBS.delete(name);
      continue;
    }

    const subscription = JSON.parse(stored);
    try {
      const resp = await sendPush(subscription, item.title, item.body);
      if (resp.status === 410 || resp.status === 404) {
        // Subscription gone — clean up sub + all its scheduled items
        await env.CCJ_SUBS.delete(subKey);
      }
    } catch (_) {}

    // Always delete the scheduled item after attempting delivery
    await env.CCJ_SUBS.delete(name);
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
