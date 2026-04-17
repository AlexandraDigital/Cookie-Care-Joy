// functions/subscribe.js
// POST /subscribe — saves a Web Push subscription to KV
// DELETE /subscribe — removes a subscription

export async function onRequestPost({ request, env }) {
  try {
    const sub = await request.json();
    if (!sub || !sub.endpoint) {
      return json({ error: "Invalid subscription" }, 400);
    }
    // Use endpoint URL hash as key (unique per browser/device)
    const key = "sub_" + btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
    await env.CCJ_SUBS.put(key, JSON.stringify(sub), {
      expirationTtl: 60 * 60 * 24 * 90 // 90 days
    });
    return json({ ok: true, key });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) return json({ error: "No endpoint" }, 400);
    const key = "sub_" + btoa(endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
    await env.CCJ_SUBS.delete(key);
    return json({ ok: true });
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
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
