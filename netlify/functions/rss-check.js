// Exact RSS checker implementation from working Replit server
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

    console.log('Checking RSS feed:', feedUrl);
    
    // Parse the RSS feed - EXACT same logic as Replit
    const feedData = await new Promise((resolve, reject) => {
      const request = require('https').get(feedUrl, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to fetch RSS feed: HTTP ${response.statusCode}`));
        }
        
        const feedparser = require('feedparser');
        const fp = new feedparser();
        let feedInfo = null;
        const episodes = [];
        
        response.pipe(fp);
        
        fp.on('error', reject);
        
        fp.on('meta', function(meta) {
          feedInfo = meta;
        });
        
        fp.on('readable', function() {
          let item;
          while (item = this.read()) {
            episodes.push(item);
          }
        });
        
        fp.on('end', function() {
          resolve({ feedInfo, episodes });
        });
      });
      
      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.abort();
        reject(new Error('Request timeout'));
      });
    });
    
    if (!feedData.feedInfo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unable to parse RSS feed' })
      };
    }

    const { feedInfo, episodes } = feedData;

    // Extract owner information properly from feedparser structure - EXACT same logic
    let owner_name = '';
    let owner_email = '';
    
    // Function to extract text from feedparser's complex object structure
    const extractText = (value) => {
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null) {
        // Handle feedparser's {'@': {}, '#': 'actual_value'} structure
        if (value['#']) return String(value['#']);
        if (value.text) return String(value.text);
        if (value._) return String(value._);
        // Handle deeply nested structure by recursively checking
        for (const key in value) {
          if (key !== '@' && typeof value[key] === 'object' && value[key]['#']) {
            return String(value[key]['#']);
          }
        }
        // Last resort: parse JSON to extract the # value
        try {
          const str = JSON.stringify(value);
          const match = str.match(/"#":"([^"]+)"/);
          if (match) return match[1];
        } catch (e) {
          // Silent fail for JSON parsing issues
        }
      }
      return '';
    };
    
    // Extract from the nested itunes:owner structure based on feedparser format
    const owner = feedInfo['itunes:owner'];
    if (owner && typeof owner === 'object') {
      // Access nested itunes:name and itunes:email within the owner object
      if (owner['itunes:name']) {
        owner_name = extractText(owner['itunes:name']);
      }
      if (owner['itunes:email']) {
        owner_email = extractText(owner['itunes:email']);
      }
    }

    // Basic feed validation
    const validation_errors = [];
    const optimization_suggestions = [];
    
    if (!feedInfo.title) {
      validation_errors.push({
        field: 'title',
        severity: 'error',
        message: 'Missing podcast title'
      });
    }
    
    if (!feedInfo.description || feedInfo.description.length < 50) {
      optimization_suggestions.push({
        field: 'description',
        severity: 'warning', 
        message: 'Add a detailed description for better discoverability'
      });
    }

    // Calculate basic SEO score
    let seo_score = 0;
    if (feedInfo.title) seo_score += 25;
    if (feedInfo.description && feedInfo.description.length >= 100) seo_score += 25;
    if (feedInfo.image && feedInfo.image.url) seo_score += 20;
    if (owner_name) seo_score += 15;
    if (episodes.length >= 3) seo_score += 15;

    // Prepare response matching Replit format
    const response_data = {
      podcast_metadata: {
        title: feedInfo.title || 'Unknown',
        description: feedInfo.description || '',
        author: feedInfo.author || owner_name || '',
        owner_name: owner_name,
        owner_email: owner_email,
        language: feedInfo.language || 'en',
        categories: feedInfo.categories || [],
        image_url: feedInfo.image?.url || '',
        episode_count: episodes.length,
        latest_episode: episodes[0]?.title || 'None',
        publish_frequency: 'Unknown',
        average_duration: 'Unknown'
      },
      feed_validation: validation_errors,
      optimization_suggestions: optimization_suggestions,
      seo_score: Math.min(100, seo_score),
      episode_count: episodes.length,
      recent_episodes: episodes.slice(0, 5).map(ep => ({
        title: ep.title || 'Untitled',
        description: ep.description ? ep.description.substring(0, 200) + '...' : '',
        publish_date: ep.pubdate || '',
        duration: ep.duration || 'Unknown'
      }))
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
        error: 'RSS check failed',
        message: error.message 
      })
    };
  }
};