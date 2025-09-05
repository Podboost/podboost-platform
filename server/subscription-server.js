const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const auth = require('./auth');

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../')));

// Initialize database
db.initializeDatabase();

// Auth routes
app.post('/api/auth/login', auth.loginWithEmail);
app.post('/api/auth/logout', auth.logout);
app.get('/api/auth/user', auth.getCurrentUser);

// Stripe checkout (updated to handle user association)
app.post('/api/create-checkout-session', auth.requireAuth, async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // Get or create Stripe customer
    let customer;
    const user = req.user;
    
    if (user.stripe_customer_id) {
      try {
        customer = await stripe.customers.retrieve(user.stripe_customer_id);
      } catch (e) {
        // Customer doesn't exist, create new one
        customer = null;
      }
    }
    
    if (!customer) {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      
      // Update user with customer ID
      await db.pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, user.id]
      );
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
      success_url: `${req.headers.origin}/premium-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/premium-signup.html?cancelled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
});

// Premium content routes (protected)
app.get('/api/premium/growth-analysis', auth.requireAuth, auth.requirePremium, (req, res) => {
  res.json({ 
    message: 'Advanced AI growth analysis available',
    features: ['detailed_insights', 'trend_prediction', 'competitive_analysis']
  });
});

app.get('/api/premium/sponsors', auth.requireAuth, auth.requirePremium, (req, res) => {
  res.json({ 
    message: 'Premium sponsor database access',
    features: ['verified_contacts', 'direct_emails', 'linkedin_profiles']
  });
});

app.get('/api/premium/campaigns', auth.requireAuth, auth.requirePremium, (req, res) => {
  res.json({ 
    message: 'Campaign manager access granted',
    features: ['create_campaigns', 'track_performance', 'manage_sponsors']
  });
});

// Public routes
app.get('/api/user/subscription-status', auth.requireAuth, async (req, res) => {
  try {
    const subscription = await db.getUserSubscription(req.user.id);
    const hasPremium = await db.hasActivePremium(req.user.id);
    
    res.json({
      hasPremium,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end
      } : null
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../login.html'));
});

app.get('/dashboard.html', auth.requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard.html'));
});

app.listen(port, () => {
  console.log(`Subscription server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database URL configured: ${!!process.env.DATABASE_URL}`);
  console.log(`Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});

module.exports = app;