// RSS checker with no external dependencies for Netlify
const https = require('https');
const http = require('http');
const { URL } = require('url');

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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
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

    // Fetch RSS content using built-in Node.js modules
    const rssText = await fetchRSSContent(feedUrl);
    const rssData = parseRSSContent(rssText);
    const validation = validateRSSData(rssData);
    const seoScore = calculateSEOScore(rssData);

    const response_data = {
      podcast_metadata: {
        title: rssData.title || 'Unknown',
        description: rssData.description || '',
        author: rssData.author || '',
        owner_name: rssData.owner_name || '',
        owner_email: rssData.owner_email || '',
        language: rssData.language || 'en',
        categories: rssData.categories || [],
        image_url: rssData.image_url || '',
        episode_count: rssData.episode_count,
        latest_episode: rssData.latest_episode || 'None',
        publish_frequency: 'Unknown',
        average_duration: 'Unknown'
      },
      feed_validation: validation.errors,
      optimization_suggestions: validation.suggestions,
      seo_score: seoScore,
      episode_count: rssData.episode_count,
      recent_episodes: rssData.recent_episodes
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response_data)
    };
    
  } catch (error) {
    console.error('RSS check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to analyze RSS feed',
        details: error.message 
      })
    };
  }
};

function fetchRSSContent(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'PodBoost RSS Checker 1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      timeout: 15000
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function parseRSSContent(rssText) {
  const extractContent = (pattern) => {
    const match = rssText.match(pattern);
    if (match) {
      const content = match[1] || match[2] || '';
      return content.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim();
    }
    return '';
  };

  const extractItemContent = (itemText, pattern) => {
    const match = itemText.match(pattern);
    if (match) {
      const content = match[1] || match[2] || '';
      return content.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim();
    }
    return '';
  };

  const title = extractContent(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
  const description = extractContent(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i);
  const author = extractContent(/<itunes:author[^>]*>(.*?)<\/itunes:author>/i);
  const language = extractContent(/<language[^>]*>(.*?)<\/language>/i);
  
  // Extract image
  let image_url = '';
  const imageMatch = rssText.match(/<itunes:image[^>]*href=["']([^"']*)/i) || 
                    rssText.match(/<image[^>]*>.*?<url[^>]*>(.*?)<\/url>/si);
  if (imageMatch) {
    image_url = imageMatch[1];
  }

  // Extract categories
  const categoryMatches = rssText.match(/<itunes:category[^>]*text=["']([^"']*)/gi) || [];
  const categories = categoryMatches.map(cat => {
    const match = cat.match(/text=["']([^"']*)/i);
    return match ? match[1] : '';
  }).filter(Boolean);

  // Extract episodes
  const episodes = [];
  const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;
  let count = 0;
  
  while ((itemMatch = itemPattern.exec(rssText)) && count < 5) {
    const itemContent = itemMatch[1];
    const epTitle = extractItemContent(itemContent, /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
    const epDesc = extractItemContent(itemContent, /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i);
    const epDuration = extractItemContent(itemContent, /<itunes:duration[^>]*>(.*?)<\/itunes:duration>/i);
    const epDate = extractItemContent(itemContent, /<pubDate[^>]*>(.*?)<\/pubDate>/i);
    
    if (epTitle) {
      episodes.push({
        title: epTitle,
        description: epDesc ? epDesc.substring(0, 200) + '...' : '',
        publish_date: epDate,
        duration: epDuration || 'Unknown'
      });
      count++;
    }
  }

  // Count total episodes
  const totalEpisodeMatches = rssText.match(/<item[^>]*>/gi) || [];
  const episode_count = totalEpisodeMatches.length;

  return {
    title: title || 'Unknown Podcast',
    description: description,
    author: author,
    owner_name: author,
    owner_email: '',
    language: language || 'en',
    image_url: image_url,
    categories: categories,
    episode_count: episode_count,
    latest_episode: episodes[0]?.title || 'None',
    recent_episodes: episodes
  };
}

function validateRSSData(rssData) {
  const errors = [];
  const suggestions = [];

  if (!rssData.title || rssData.title === 'Unknown Podcast') {
    errors.push('Missing podcast title');
    suggestions.push('Add a clear, descriptive title to your podcast');
  }

  if (!rssData.description) {
    errors.push('Missing podcast description');
    suggestions.push('Add a compelling description that explains what your podcast is about');
  }

  if (!rssData.author) {
    errors.push('Missing author information');
    suggestions.push('Include author/creator information for better discoverability');
  }

  if (!rssData.image_url) {
    errors.push('Missing podcast artwork');
    suggestions.push('Add high-quality artwork (1400x1400px minimum) for better visibility');
  }

  if (!rssData.categories || rssData.categories.length === 0) {
    errors.push('Missing categories');
    suggestions.push('Categorize your podcast to improve discoverability in podcast directories');
  }

  if (rssData.episode_count === 0) {
    errors.push('No episodes found');
    suggestions.push('Publish episodes regularly to maintain audience engagement');
  }

  return { errors, suggestions };
}

function calculateSEOScore(rssData) {
  let score = 0;
  const maxScore = 100;
  
  // Title (20 points)
  if (rssData.title && rssData.title !== 'Unknown Podcast') {
    score += 20;
    if (rssData.title.length >= 10 && rssData.title.length <= 60) {
      score += 5; // Bonus for good title length
    }
  }
  
  // Description (20 points)
  if (rssData.description) {
    score += 20;
    if (rssData.description.length >= 100) {
      score += 5; // Bonus for detailed description
    }
  }
  
  // Author (15 points)
  if (rssData.author) {
    score += 15;
  }
  
  // Artwork (15 points)
  if (rssData.image_url) {
    score += 15;
  }
  
  // Categories (10 points)
  if (rssData.categories && rssData.categories.length > 0) {
    score += 10;
  }
  
  // Episodes (15 points)
  if (rssData.episode_count > 0) {
    score += 15;
    if (rssData.episode_count >= 10) {
      score += 5; // Bonus for having multiple episodes
    }
  }
  
  return Math.min(score, maxScore);
}