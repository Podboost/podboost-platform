const db = require('./database');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];
  
  if (!sessionToken) {
    return res.status(401).json({ 
      error: 'Authentication required',
      redirectTo: '/login.html'
    });
  }
  
  db.getSessionUser(sessionToken)
    .then(user => {
      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid or expired session',
          redirectTo: '/login.html'
        });
      }
      
      req.user = user;
      next();
    })
    .catch(error => {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication error' });
    });
}

// Middleware to check if user has premium subscription
async function requirePremium(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        redirectTo: '/login.html'
      });
    }
    
    const hasPremium = await db.hasActivePremium(req.user.id);
    
    if (!hasPremium) {
      return res.status(403).json({ 
        error: 'Premium subscription required',
        redirectTo: '/premium-signup.html'
      });
    }
    
    next();
  } catch (error) {
    console.error('Premium check error:', error);
    res.status(500).json({ error: 'Premium verification error' });
  }
}

// Login with email (passwordless for simplicity)
async function loginWithEmail(req, res) {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    // Get or create user
    let user = await db.getUserByEmail(email);
    if (!user) {
      user = await db.createUser(email);
    }
    
    // Create session
    const session = await db.createSession(user.id);
    
    // Set session cookie
    res.cookie('session_token', session.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json({ 
      success: true, 
      user: { id: user.id, email: user.email },
      redirectTo: '/dashboard.html'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

// Logout
async function logout(req, res) {
  try {
    const sessionToken = req.cookies?.session_token;
    
    if (sessionToken) {
      await db.deleteSession(sessionToken);
    }
    
    res.clearCookie('session_token');
    res.json({ success: true, redirectTo: '/' });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

// Get current user info
async function getCurrentUser(req, res) {
  try {
    const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = await db.getSessionUser(sessionToken);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const hasPremium = await db.hasActivePremium(user.id);
    
    res.json({ 
      user: { 
        id: user.id, 
        email: user.email,
        hasPremium: hasPremium
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
}

module.exports = {
  requireAuth,
  requirePremium,
  loginWithEmail,
  logout,
  getCurrentUser
};