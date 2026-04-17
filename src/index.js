import webpush from 'web-push';

// List of motivational messages
const motivationalMessages = [
  "Every cookie baked with care brings joy to someone's day! 🍪",
  "You're doing amazing, keep spreading sweetness! 💛",
  "Remember to take breaks and enjoy the little things! ☕",
  "Your dedication to Cookie Care Joy is inspiring! ✨",
  "Each act of kindness is like a fresh-baked cookie! 🥭",
  "You've got this! Keep being awesome! 🌟",
  "Spread joy like sprinkles on a cupcake! 🧁",
  "Your smile is the best ingredient in life! 😊",
  "Keep shining bright, you magnificent human! ☀️",
  "Today is the perfect day for something sweet! 🎂",
];

// Helper: Get a random motivational message
function getRandomMessage() {
  return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
}

// Helper: Send push notification
async function sendPush(subscription, payload, env) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { status: 'sent' };
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      return { status: 'expired' };
    }
    console.error('Push error:', error.message);
    return { status: 'error', message: error.message };
  }
}

// Helper: Handle cron job (send push notifications to all subscribers)
async function handleCronSchedule(env) {
  try {
    console.log('🔔 Starting scheduled push notifications...');

    // Get all subscriptions from KV
    const allKeys = await env.CCJ_SUBS.list();
    console.log(`Found ${allKeys.keys.length} subscribers`);

    if (allKeys.keys.length === 0) {
      console.log('No subscribers found');
      return new Response('No subscribers', { status: 200 });
    }

    // Get the random message
    const messageTitle = 'Cookie Care Joy';
    const messageBody = getRandomMessage();

    // Send push to all subscribers
    const pushPromises = allKeys.keys.map(async (key) => {
      const subscription = await env.CCJ_SUBS.get(key.name, 'json');
      if (!subscription) return { status: 'error', message: 'No subscription data' };

      const payload = {
        title: messageTitle,
        body: messageBody,
        icon: '/icon-192x192.png',
      };

      return await sendPush(subscription, payload, env);
    });

    const results = await Promise.allSettled(pushPromises);

    // Log summary
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value?.status === 'sent').length;
    const expired = results.filter((r) => r.status === 'fulfilled' && r.value?.status === 'expired').length;
    const errors = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.status === 'error')).length;

    console.log(`📊 Summary: ${sent} sent, ${expired} expired, ${errors} errors`);

    // Clean up expired subscriptions
    for (let i = 0; i < allKeys.keys.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value?.status === 'expired') {
        await env.CCJ_SUBS.delete(allKeys.keys[i].name);
        console.log(`🗑️ Deleted expired subscription: ${allKeys.keys[i].name}`);
      }
    }
  } catch (error) {
    console.error('Cron error:', error);
  }
}

// Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Route: POST /subscribe - Add a new subscription
    if (pathname === '/subscribe' && request.method === 'POST') {
      try {
        const subscription = await request.json();
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await env.CCJ_SUBS.put(subscriptionId, JSON.stringify(subscription));
        console.log(`✅ New subscription: ${subscriptionId}`);
        return new Response(JSON.stringify({ success: true, id: subscriptionId }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Subscribe error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Route: DELETE /subscribe/:id - Remove a subscription
    if (pathname.startsWith('/subscribe/') && request.method === 'DELETE') {
      try {
        const id = pathname.split('/')[2];
        await env.CCJ_SUBS.delete(id);
        console.log(`❌ Deleted subscription: ${id}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Delete error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Route: POST /send-push - Manual push notification
    if (pathname === '/send-push' && request.method === 'POST') {
      try {
        const { subscription, title, body } = await request.json();
        const payload = { title, body, icon: '/icon-192x192.png' };
        const result = await sendPush(subscription, payload, env);
        return new Response(JSON.stringify(result), {
          status: result.status === 'sent' ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Send push error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Route: GET / - Health check
    if (pathname === '/' && request.method === 'GET') {
      return new Response('Cookie Care Joy Worker is running! 🍪', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Scheduled handler - runs on cron trigger
  async scheduled(event, env, ctx) {
    console.log('⏰ Cron triggered at', new Date().toISOString());
    ctx.waitUntil(handleCronSchedule(env));
  },
};
