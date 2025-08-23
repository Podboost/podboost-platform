const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const sig = event.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('Stripe webhook secret not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Webhook secret not configured' })
      };
    }

    // Verify webhook signature
    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Webhook error: ${err.message}` })
      };
    }

    const client = await pool.connect();

    try {
      switch (stripeEvent.type) {
        case 'checkout.session.completed': {
          const session = stripeEvent.data.object;
          
          if (session.mode === 'subscription') {
            // Get the subscription
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            
            // Get or create user by customer email
            const customer = await stripe.customers.retrieve(session.customer);
            
            let user;
            const userResult = await client.query('SELECT * FROM users WHERE email = $1', [customer.email]);
            
            if (userResult.rows.length === 0) {
              const insertResult = await client.query(
                'INSERT INTO users (email, stripe_customer_id) VALUES ($1, $2) RETURNING *',
                [customer.email, customer.id]
              );
              user = insertResult.rows[0];
            } else {
              user = userResult.rows[0];
              // Update stripe customer ID if not set
              if (!user.stripe_customer_id) {
                await client.query(
                  'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
                  [customer.id, user.id]
                );
              }
            }

            // Create subscription record
            await client.query(`
              INSERT INTO subscriptions (user_id, stripe_subscription_id, status, current_period_start, current_period_end)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (stripe_subscription_id) 
              DO UPDATE SET 
                status = EXCLUDED.status,
                current_period_start = EXCLUDED.current_period_start,
                current_period_end = EXCLUDED.current_period_end,
                updated_at = CURRENT_TIMESTAMP
            `, [
              user.id,
              subscription.id,
              subscription.status,
              new Date(subscription.current_period_start * 1000),
              new Date(subscription.current_period_end * 1000)
            ]);

            console.log('Subscription created for user:', user.email);
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = stripeEvent.data.object;
          
          // Update subscription status
          await client.query(`
            UPDATE subscriptions 
            SET status = $1, 
                current_period_start = $2,
                current_period_end = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = $4
          `, [
            subscription.status,
            new Date(subscription.current_period_start * 1000),
            new Date(subscription.current_period_end * 1000),
            subscription.id
          ]);

          console.log('Subscription updated:', subscription.id, 'Status:', subscription.status);
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = stripeEvent.data.object;
          
          if (invoice.subscription) {
            // Update subscription period
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            
            await client.query(`
              UPDATE subscriptions 
              SET current_period_start = $1,
                  current_period_end = $2,
                  updated_at = CURRENT_TIMESTAMP
              WHERE stripe_subscription_id = $3
            `, [
              new Date(subscription.current_period_start * 1000),
              new Date(subscription.current_period_end * 1000),
              subscription.id
            ]);

            console.log('Subscription period updated after payment:', subscription.id);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = stripeEvent.data.object;
          
          if (invoice.subscription) {
            await client.query(`
              UPDATE subscriptions 
              SET status = 'past_due',
                  updated_at = CURRENT_TIMESTAMP
              WHERE stripe_subscription_id = $1
            `, [invoice.subscription]);

            console.log('Subscription marked past_due:', invoice.subscription);
          }
          break;
        }

        default:
          console.log('Unhandled webhook event type:', stripeEvent.type);
      }

    } finally {
      client.release();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};