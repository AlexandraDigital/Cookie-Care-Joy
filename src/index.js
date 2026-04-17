// src/index.js — Main Worker entry point
// Routes HTTP requests and handles scheduled cron triggers

import { sendPush } from "../functions/send-push.js";

// ─── Scheduled Cron Handler ───────────────────────────────────────────────────

export async function scheduled(event, env, ctx) {
  try {
    console.log("Cron triggered at", new Date().toISOString());

    // Get all stored subscriptions from KV
    const subscriptions = await env.CCJ_SUBS.list();

    if (!subscriptions.keys || subscriptions.keys.length === 0) {
      console.log("No subscriptions found");
      return;
    }

    console.log(`Found ${subscriptions.keys.length} subscriptions, sending notifications...`);

    // Array of motivational messages
    const motivations = [
      { title: "🍪 Cookie Care Joy", body: "Time for a moment of joy—you've got this!" },
      { title: "✨ Self-Care Reminder", body: "Pause and celebrate yourself. You matter!" },
      { title: "💪 You're Doing Great", body: "Keep going—progress looks good on you!" },
      { title: "🌟 Moment of Gratitude", body: "Grateful for you showing up for yourself today." },
      { title: "🎉 Keep Shining", body: "Your effort makes a difference. Well done!" },
    ];

    const randomMsg = motivations[Math.floor(Math.random() * motivations.length)];

    // Send to each subscription
    const results = await Promise.allSettled(
      subscriptions.keys.map(async (key) => {
        const subData = await env.CCJ_SUBS.get(key.name);
        if (!subData) return { status: "missing" };

        try {
          const subscription = JSON.parse(subData);
          const response = await sendPush(subscription, randomMsg.title, randomMsg.body);

          if (response.status === 410 || response.status === 404) {
            // Subscription expired — clean up
            await env.CCJ_SUBS.delete(key.name);
            return { status: "expired", key: key.name };
          }

          return { status: "sent", key: key.name, httpStatus: response.status };
        } catch (err) {
          console.error(`Error sending to ${key.name}:`, err);
          return { status: "error", key: key.name, error: err.message };
        }
      })
    );

    // Log summary
    const sent = results.filter((r) => r.value?.status === "sent").length;
    const expired = results.filter((r) => r.value?.status === "expired").length;
    const errors = results.filter((r) => r.value?.status === "error").length;

    console.log(`Cron complete: sent=${sent}, expired=${expired}, errors=${errors}`);
  } catch (err) {
    console.error("Cron handler error:", err);
  }
}

// ─── HTTP Request Router ──────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // POST /subscribe — save a Web Push subscription
    if (path === "/subscribe" && method === "POST") {
      try {
        const sub = await request.json();
        if (!sub || !sub.endpoint) {
          return json({ error: "Invalid subscription" }, 400);
        }
        const key = "sub_" + btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
        await env.CCJ_SUBS.put(key, JSON.stringify(sub), {
          expirationTtl: 60 * 60 * 24 * 90, // 90 days
        });
        return json({ ok: true, key });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // DELETE /subscribe — remove a subscription
    if (path === "/subscribe" && method === "DELETE") {
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

    // POST /send-push — send a Web Push notification
    if (path === "/send-push" && method === "POST") {
      try {
        const { endpoint, title, body } = await request.json();
        if (!endpoint) return json({ error: "No endpoint" }, 400);

        const key = "sub_" + btoa(endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
        const stored = await env.CCJ_SUBS.get(key);
        if (!stored) return json({ error: "Subscription not found" }, 404);

        const subscription = JSON.parse(stored);
        const resp = await sendPush(
          subscription,
          title || "Cookie-Care-Joy 🍪",
          body || "Time to take care of yourself ✨"
        );

        if (resp.status === 410 || resp.status === 404) {
          await env.CCJ_SUBS.delete(key);
          return json({ ok: false, expired: true });
        }

        return json({ ok: resp.ok, status: resp.status });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 404
    return json({ error: "Not Found" }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
