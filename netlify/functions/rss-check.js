const https = require('https');
const http = require('http');
const { URL } = require('url');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const { feedUrl, rss_url, feed_url } = JSON.parse(event.body);
    const finalFeedUrl = feedUrl || rss_url || feed_url;
    
    if (!finalFeedUrl) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Feed URL is required' }),
      };
    }

    // Fetch RSS feed
    const feedContent = await fetchRSSFeed(finalFeedUrl);
    const analysis = analyzeRSSFeed(feedContent);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analysis),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function fetchRSSFeed(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function analyzeRSSFeed(content) {
  // Basic RSS analysis
  const hasTitle = content.includes('<title>');
  const hasDescription = content.includes('<description>');
  const hasImage = content.includes('<image>') || content.includes('<itunes:image>');
  const hasCategory = content.includes('<category>') || content.includes('<itunes:category>');
  
  const issues = [];
  const recommendations = [];
  
  if (!hasTitle) issues.push('Missing podcast title');
  if (!hasDescription) issues.push('Missing podcast description');
  if (!hasImage) recommendations.push('Add podcast artwork for better visibility');
  if (!hasCategory) recommendations.push('Add categories for better discoverability');
  
  return {
    valid: issues.length === 0,
    issues,
    recommendations,
    score: Math.max(0, 100 - (issues.length * 25) - (recommendations.length * 10))
  };
}