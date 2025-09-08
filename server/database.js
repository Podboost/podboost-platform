const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        stripe_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL,
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

// User management functions
async function createUser(email, stripeCustomerId = null) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'INSERT INTO users (email, stripe_customer_id) VALUES ($1, $2) RETURNING *',
      [email, stripeCustomerId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getUserByEmail(email) {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getUserById(userId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Subscription management functions
async function createOrUpdateSubscription(userId, subscriptionData) {
  const client = await pool.connect();
  
  try {
    const { stripe_subscription_id, status, current_period_start, current_period_end } = subscriptionData;
    
    const result = await client.query(`
      INSERT INTO subscriptions (user_id, stripe_subscription_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (stripe_subscription_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, stripe_subscription_id, status, current_period_start, current_period_end]);
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getUserSubscription(userId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT * FROM subscriptions 
      WHERE user_id = $1 AND status IN ('active', 'trialing')
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function hasActivePremium(userId) {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) return false;
  
  const now = new Date();
  const periodEnd = new Date(subscription.current_period_end);
  
  return subscription.status === 'active' && periodEnd > now;
}

// Session management
async function createSession(userId) {
  const client = await pool.connect();
  
  try {
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    const result = await client.query(
      'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3) RETURNING *',
      [userId, sessionToken, expiresAt]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getSessionUser(sessionToken) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT u.*, s.expires_at 
      FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.expires_at > NOW()
    `, [sessionToken]);
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteSession(sessionToken) {
  const client = await pool.connect();
  
  try {
    await client.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initializeDatabase,
  createUser,
  getUserByEmail,
  getUserById,
  createOrUpdateSubscription,
  getUserSubscription,
  hasActivePremium,
  createSession,
  getSessionUser,
  deleteSession
};