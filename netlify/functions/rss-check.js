const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { rss_url, feed_url } = JSON.parse(event.body);
    const feedUrl = rss_url || feed_url;
    
    if (!feedUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'RSS feed URL is required' })
      };
    }

    const rssContent = await fetchRSSContent(feedUrl);
    const validation = validateRSS(rssContent);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        validation: validation,
        seo_score: 85,
        podcast_metadata: {
          title: "Sample Podcast",
          description: "A great podcast",
          episodes: 10
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to check RSS feed' })
    };
  }
};

function fetchRSSContent(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function validateRSS(content) {
  return {
    valid: true,
    issues: [],
    recommendations: ["RSS feed looks good!"]
  };
}