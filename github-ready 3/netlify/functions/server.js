const serverless = require('serverless-http');
const express = require('express');
const path = require('path');

// Import your existing server logic
const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files
app.use(express.static('.'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import all your API routes from simple-server.js
// This is a simplified version - you'll need to copy your routes here

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PodBoost API is running on Netlify' });
});

module.exports.handler = serverless(app);