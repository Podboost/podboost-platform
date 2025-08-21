const feedparser = require('feedparser');
const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { rss_url, feed_url } = JSON.parse(event.body);
    const feedUrl = rss_url || feed_url;
    
    if (!feedUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'RSS feed URL is required' })
      };
    }

    console.log('Checking RSS feed:', feedUrl);
    
    // Parse the RSS feed using feedparser with proper protocol handling
    const feedData = await new Promise((resolve, reject) => {
      const protocol = feedUrl.startsWith('https:') ? https : http;
      const request = protocol.get(feedUrl, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`RSS feed redirect: ${response.statusCode} -> ${response.headers.location}`);
          const newProtocol = response.headers.location.startsWith('https:') ? https : http;
          return newProtocol.get(response.headers.location, (redirectResponse) => {
            if (redirectResponse.statusCode !== 200) {
              return reject(new Error(`Failed to fetch RSS feed after redirect: HTTP ${redirectResponse.statusCode}`));
            }
            processResponse(redirectResponse, resolve, reject);
          }).on('error', reject);
        }
        
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to fetch RSS feed: HTTP ${response.statusCode}`));
        }
        
        processResponse(response, resolve, reject);
      });
      
      function processResponse(response, resolve, reject) {
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
      }
      
      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.abort();
        reject(new Error('Request timeout'));
      });
    });
    
    if (!feedData.feedInfo) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unable to parse RSS feed' })
      };
    }

    const { feedInfo, episodes } = feedData;

    // Extract text helper function
    const extractText = (value) => {
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null) {
        if (value['#']) return String(value['#']);
        if (value.text) return String(value.text);
        if (value._) return String(value._);
        for (const key in value) {
          if (key !== '@' && typeof value[key] === 'object' && value[key]['#']) {
            return String(value[key]['#']);
          }
        }
        try {
          const str = JSON.stringify(value);
          const match = str.match(/"#":"([^"]+)"/);
          if (match) return match[1];
        } catch (e) {
          // Silent fail
        }
      }
      return '';
    };
    
    // Extract owner information
    let owner_name = '';
    let owner_email = '';
    
    const owner = feedInfo['itunes:owner'];
    if (owner && typeof owner === 'object') {
      if (owner['itunes:name']) {
        owner_name = extractText(owner['itunes:name']);
      }
      if (owner['itunes:email']) {
        owner_email = extractText(owner['itunes:email']);
      }
    }
    
    if (!owner_name) {
      owner_name = extractText(feedInfo['itunes:name']) || '';
    }
    if (!owner_email) {
      owner_email = extractText(feedInfo['itunes:email']) || '';
    }

    let author = feedInfo.author || feedInfo.managingEditor || '';
    if (typeof author === 'object') {
      author = author.name || author['#'] || '';
    }
    if (!author) author = owner_name;

    const podcast_metadata = {
      title: feedInfo.title || '',
      description: feedInfo.description || '',
      link: feedInfo.link || '',
      language: feedInfo.language || '',
      author: author,
      image: feedInfo.image?.url || feedInfo.image?.href || '',
      categories: feedInfo.categories ? feedInfo.categories.map(cat => cat._ || cat) : [],
      owner_name: owner_name,
      owner_email: owner_email,
      copyright: feedInfo.copyright || '',
      episode_count: episodes.length
    };

    // Process recent episodes
    const recent_episodes = episodes.slice(0, 10).map(episode => ({
      title: episode.title || '',
      description: episode.description || '',
      publish_date: episode.pubdate || episode.date || '',
      duration: episode['itunes:duration'] || '',
      enclosure_url: episode.enclosures?.[0]?.url || '',
      guid: episode.guid || ''
    }));

    // Basic validation checks
    const validation_issues = [];
    const optimization_suggestions = [];

    if (!podcast_metadata.title) {
      validation_issues.push({
        level: 'error',
        message: 'Missing podcast title'
      });
    }

    if (!podcast_metadata.description) {
      validation_issues.push({
        level: 'error', 
        message: 'Missing podcast description'
      });
    }

    if (!podcast_metadata.image) {
      validation_issues.push({
        level: 'warning',
        message: 'Missing podcast artwork'
      });
    }

    if (podcast_metadata.categories.length === 0) {
      optimization_suggestions.push({
        title: 'Add Categories',
        description: 'Adding iTunes categories helps with discoverability',
        recommendation: 'Add relevant iTunes categories to your RSS feed'
      });
    }

    if (!owner_email) {
      optimization_suggestions.push({
        title: 'Add Owner Email',
        description: 'Owner email is required for iTunes and Spotify',
        recommendation: 'Add <itunes:email> tag with contact email'
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        status: 'success',
        podcast_metadata,
        recent_episodes,
        validation_issues,
        optimization_suggestions,
        analysis_date: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('RSS analysis error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to analyze RSS feed',
        message: error.message 
      })
    };
  }
};