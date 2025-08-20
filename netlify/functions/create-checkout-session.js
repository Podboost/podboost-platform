exports.handler = async (event, context) => {
    // Set CORS headers for all responses
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Initialize Stripe with secret key from environment
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        if (!process.env.STRIPE_SECRET_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Stripe secret key not configured in Netlify environment variables' })
            };
        }

        const { priceId, successUrl, cancelUrl } = JSON.parse(event.body);

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'PodBoost Premium',
                            description: 'Advanced podcast analytics and growth tools',
                        },
                        unit_amount: 700, // $7.00 in cents
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            success_url: successUrl || 'https://podboost.com.au/premium-success',
            cancel_url: cancelUrl || 'https://podboost.com.au/premium-signup',
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ id: session.id, url: session.url })
        };

    } catch (error) {
        console.error('Stripe error:', error);
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