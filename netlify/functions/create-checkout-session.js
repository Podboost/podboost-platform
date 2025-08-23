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
        'Access-Control-Allow-Headers': 'Content-Type, Cookie, X-Session-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
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
        if (!process.env.STRIPE_SECRET_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Stripe not configured' })
            };
        }

        // Extract session token from cookies or headers
        const sessionToken = event.headers.cookie?.match(/session_token=([^;]+)/)?.[1] || 
                             event.headers['x-session-token'];

        if (!sessionToken) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: 'Authentication required',
                    redirectTo: '/login.html'
                })
            };
        }

        // Verify user session
        const client = await pool.connect();
        let user;
        
        try {
            const result = await client.query(`
                SELECT u.*, s.expires_at 
                FROM users u
                JOIN user_sessions s ON u.id = s.user_id
                WHERE s.session_token = $1 AND s.expires_at > NOW()
            `, [sessionToken]);
            
            user = result.rows[0];
        } finally {
            client.release();
        }

        if (!user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: 'Invalid or expired session',
                    redirectTo: '/login.html'
                })
            };
        }

        // Get or create Stripe customer
        let customer;
        
        if (user.stripe_customer_id) {
            try {
                customer = await stripe.customers.retrieve(user.stripe_customer_id);
            } catch (e) {
                customer = null; // Customer doesn't exist, create new one
            }
        }
        
        if (!customer) {
            customer = await stripe.customers.create({
                email: user.email,
                metadata: { user_id: user.id }
            });
            
            // Update user with customer ID
            const updateClient = await pool.connect();
            try {
                await updateClient.query(
                    'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
                    [customer.id, user.id]
                );
            } finally {
                updateClient.release();
            }
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer: customer.id,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'PodBoost Premium',
                            description: 'Advanced podcast analytics, growth tools, sponsor finder, and campaign management',
                        },
                        unit_amount: 700, // $7.00 in cents
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            success_url: `${event.headers.origin}/premium-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${event.headers.origin}/premium-signup.html?cancelled=true`,
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            metadata: {
                user_id: user.id,
                user_email: user.email
            }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                id: session.id,
                url: session.url
            })
        };

    } catch (error) {
        console.error('Stripe checkout error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to create checkout session',
                details: error.message 
            })
        };
    }
};