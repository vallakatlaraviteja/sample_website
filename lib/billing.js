// Stripe billing for the "Verified" tier ($5/mo).
// Without STRIPE_SECRET_KEY the paid tier is disabled - app still runs.

const db = require('../db');

let stripe = null;
function client() {
  if (stripe) return stripe;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // Lazy require so the dep is optional at runtime.
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  return stripe;
}

function isEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_VERIFIED);
}

async function createCheckoutSession(user) {
  const s = client();
  if (!s) throw new Error('billing_disabled');
  if (!process.env.STRIPE_PRICE_VERIFIED) throw new Error('no_price');
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_VERIFIED, quantity: 1 }],
    customer_email: user.email || undefined,
    client_reference_id: String(user.id),
    success_url: `${process.env.PUBLIC_URL}/?verified=success`,
    cancel_url: `${process.env.PUBLIC_URL}/?verified=cancel`,
    metadata: { user_id: String(user.id), login: user.login },
  });
  return session.url;
}

async function handleWebhook(req, rawBody) {
  const s = client();
  if (!s || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { ok: false, reason: 'webhook_disabled' };
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = s.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { ok: false, reason: 'bad_signature', detail: err.message };
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const sess = event.data.object;
      const userId = Number(sess.client_reference_id || sess.metadata?.user_id);
      if (userId && db.pool) {
        await db.pool.query(
          `UPDATE users SET is_verified = TRUE, stripe_customer_id = $2, stripe_sub_id = $3 WHERE id = $1`,
          [userId, sess.customer, sess.subscription]
        );
      }
      break;
    }
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      if (!db.pool) break;
      const status = sub.status;
      const verified = status === 'active' || status === 'trialing';
      await db.pool.query(
        `UPDATE users SET is_verified = $2 WHERE stripe_sub_id = $1`,
        [sub.id, verified]
      );
      break;
    }
    default:
      // ignore
  }
  return { ok: true };
}

module.exports = { isEnabled, createCheckoutSession, handleWebhook };
