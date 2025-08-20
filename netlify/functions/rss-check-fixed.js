// Simple, reliable RSS checker using fetch API
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
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'RSS feed URL is required' }) };
        }

        // Use node-fetch for better compatibility
        const response = await fetch(feedUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'PodBoost RSS Checker 1.0' },
            timeout: 15000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const rssText = await response.text();
        const rssData = parseRSSContent(rssText);
        const validation = validateRSSData(rssData);
        const seoScore = calculateSEOScore(rssData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                podcast_metadata: rssData,
                feed_validation: validation.errors,
                optimization_suggestions: validation.suggestions,
                seo_score: seoScore,
                episode_count: rssData.episode_count,
                recent_episodes: rssData.recent_episodes
            })
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

function parseRSSContent(rssText) {
    const extractContent = (pattern) => {
        const match = rssText.match(pattern);
        if (match) {
            const content = match[1] || match[2] || '';
            return content.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim();
        }
        return '';
    };

    const title = extractContent(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
    const description = extractContent(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i);
    const author = extractContent(/<itunes:author[^>]*>(.*?)<\/itunes:author>/i);
    
    // Extract episodes
    const episodes = [];
    const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let itemMatch;
    let count = 0;
    
    while ((itemMatch = itemPattern.exec(rssText)) && count < 5) {
        const itemContent = itemMatch[1];
        const epTitle = extractContent(itemContent.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i) || ['', '']);
        
        if (epTitle) {
            episodes.push({ title: epTitle });
            count++;
        }
    }

    return {
        title: title || 'Unknown Podcast',
        description: description,
        author: author,
        episode_count: episodes.length,
        recent_episodes: episodes
    };
}

function validateRSSData(rssData) {
    const errors = [];
    const suggestions = [];
    
    if (!rssData.title || rssData.title === 'Unknown Podcast') {
        errors.push({
            field: 'title',
            severity: 'error',
            message: 'Missing podcast title'
        });
    }
    
    if (!rssData.description || rssData.description.length < 50) {
        suggestions.push({
            field: 'description',
            severity: 'warning',
            message: 'Add detailed description for better discoverability'
        });
    }
    
    return { errors, suggestions };
}

function calculateSEOScore(rssData) {
    let score = 0;
    if (rssData.title && rssData.title !== 'Unknown Podcast') score += 30;
    if (rssData.description && rssData.description.length >= 100) score += 30;
    if (rssData.author) score += 20;
    if (rssData.episode_count >= 3) score += 20;
    return Math.min(100, score);
}