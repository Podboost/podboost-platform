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
        body: JSON.stringify({ error: 'RSS feed URL is required' }),
      };
    }

    // Fetch and parse RSS feed
    const feedContent = await fetchRSSFeed(finalFeedUrl);
    const analysis = parseRSSFeed(feedContent);

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

function parseRSSFeed(content) {
  // Extract podcast metadata using regex patterns similar to feedparser results
  const podcast_metadata = {};
  
  // Extract title
  const titleMatch = content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
  podcast_metadata.title = titleMatch ? (titleMatch[1] || titleMatch[2]) : '';
  
  // Extract description
  const descMatch = content.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
  podcast_metadata.description = descMatch ? (descMatch[1] || descMatch[2]) : '';
  
  // Extract author
  const authorMatch = content.match(/<itunes:author><!\[CDATA\[(.*?)\]\]><\/itunes:author>|<itunes:author>(.*?)<\/itunes:author>/);
  podcast_metadata.author = authorMatch ? (authorMatch[1] || authorMatch[2]) : '';
  
  // Extract image
  const imageMatch = content.match(/<itunes:image\s+href="([^"]*)"/) || content.match(/<image>\s*<url>(.*?)<\/url>/);
  podcast_metadata.image = imageMatch ? imageMatch[1] : '';
  
  // Extract link
  const linkMatch = content.match(/<link>(.*?)<\/link>/);
  podcast_metadata.link = linkMatch ? linkMatch[1] : '';
  
  // Extract language
  const languageMatch = content.match(/<language>(.*?)<\/language>/);
  podcast_metadata.language = languageMatch ? languageMatch[1] : '';
  
  // Extract categories
  const categoryMatches = content.match(/<itunes:category\s+text="([^"]*)"/g) || [];
  podcast_metadata.categories = categoryMatches.map(match => {
    const categoryMatch = match.match(/text="([^"]*)"/);
    return categoryMatch ? categoryMatch[1] : '';
  }).filter(Boolean);
  
  // Extract owner information
  const ownerNameMatch = content.match(/<itunes:name><!\[CDATA\[(.*?)\]\]><\/itunes:name>|<itunes:name>(.*?)<\/itunes:name>/);
  podcast_metadata.owner_name = ownerNameMatch ? (ownerNameMatch[1] || ownerNameMatch[2]) : '';
  
  const ownerEmailMatch = content.match(/<itunes:email>(.*?)<\/itunes:email>/);
  podcast_metadata.owner_email = ownerEmailMatch ? ownerEmailMatch[1] : '';
  
  // Extract copyright
  const copyrightMatch = content.match(/<copyright>(.*?)<\/copyright>/);
  podcast_metadata.copyright = copyrightMatch ? copyrightMatch[1] : '';
  
  // Count episodes
  const itemMatches = content.match(/<item[\s>]/g) || [];
  podcast_metadata.episode_count = itemMatches.length;
  
  // Validation checks
  const feed_validation = [];
  const optimization_suggestions = [];
  
  if (!podcast_metadata.title) {
    feed_validation.push({
      field: 'title',
      severity: 'error',
      message: 'Missing podcast title',
      recommendation: 'Add a clear, descriptive title to your podcast'
    });
  }
  
  if (!podcast_metadata.description || podcast_metadata.description.length < 50) {
    feed_validation.push({
      field: 'description', 
      severity: 'warning',
      message: 'Description is missing or too short',
      recommendation: 'Add a detailed description (150-300 characters) for better discoverability'
    });
  }
  
  if (!podcast_metadata.image) {
    feed_validation.push({
      field: 'image',
      severity: 'error', 
      message: 'Missing podcast artwork',
      recommendation: 'Add high-quality artwork (1400x1400px minimum) for better platform visibility'
    });
  }
  
  if (!podcast_metadata.categories || podcast_metadata.categories.length === 0) {
    optimization_suggestions.push({
      field: 'categories',
      severity: 'warning',
      message: 'No categories specified', 
      recommendation: 'Add relevant iTunes categories to improve discoverability'
    });
  }
  
  if (!podcast_metadata.author) {
    optimization_suggestions.push({
      field: 'author',
      severity: 'warning',
      message: 'Missing author information',
      recommendation: 'Add author/host information for better credibility'
    });
  }
  
  // Check for trailer episodes
  const trailerCheck = content.toLowerCase().includes('episodetype="trailer"') || 
                       content.toLowerCase().includes('trailer');
                       
  if (!trailerCheck) {
    optimization_suggestions.push({
      field: 'episodes.trailer',
      severity: 'error',
      message: 'No trailer episodes found - Critical for Apple and Spotify promotion',
      recommendation: 'Create a trailer episode immediately! Apple and Spotify use trailers to promote podcasts in search results and recommendations. Mark it with itunes:episodeType="trailer"'
    });
  }
  
  // Calculate SEO score
  let seo_score = 100;
  feed_validation.forEach(issue => {
    seo_score -= issue.severity === 'error' ? 20 : 10;
  });
  optimization_suggestions.forEach(suggestion => {
    seo_score -= suggestion.severity === 'error' ? 15 : 5;
  });
  seo_score = Math.max(0, Math.min(100, seo_score));
  
  return {
    podcast_metadata,
    feed_validation,
    optimization_suggestions,
    seo_score,
    episode_count: podcast_metadata.episode_count
  };
}