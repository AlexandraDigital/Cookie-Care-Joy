// Cookie-Care-Joy Welcome Notification Worker
// Sends a OneSignal welcome push to a specific device (by player ID)
// Deploy on Cloudflare Workers — store your REST API key as an env variable named ONESIGNAL_API_KEY

const ONESIGNAL_APP_ID = "fc237358-e343-4a93-adfe-b22527bb0aef";

export default {
  async fetch(request, env) {
    // Allow CORS from your app
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    let playerId;
    try {
      const body = await request.json();
      playerId = body.playerId;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!playerId) {
      return new Response(JSON.stringify({ error: "Missing playerId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: [playerId],
      headings: { en: "🍪 Welcome to Cookie-Care-Joy!" },
      contents: { en: "Sweet reminders are set — we'll check in on you 💕" },
      small_icon: "ic_stat_onesignal_default",
      priority: 10,
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${env.ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
