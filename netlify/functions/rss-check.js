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
        
        // Fetch RSS feed using Node.js built-in modules
        const feedData = await fetchRSSFeed(feedUrl);
        
        if (!feedData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Unable to parse RSS feed' })
            };
        }

        // Parse and validate the RSS feed
        const rssData = parseRSSFeed(feedData);
        const validation = validateRSSFeed(rssData);
        const seoScore = calculateSEOScore(rssData, validation);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                podcast_metadata: rssData,
                feed_validation: validation.errors,
                optimization_suggestions: validation.suggestions,
                seo_score: seoScore,
                episode_count: rssData.episode_count || 0
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

// Fetch RSS feed using Node.js built-in modules
function fetchRSSFeed(feedUrl) {
    return new Promise((resolve, reject) => {
        const protocol = feedUrl.startsWith('https') ? https : http;
        
        const request = protocol.get(feedUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to fetch RSS feed: HTTP ${response.statusCode}`));
                return;
            }
            
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
            response.on('error', reject);
        });
        
        request.on('error', reject);
        request.setTimeout(10000, () => {
            request.abort();
            reject(new Error('Request timeout'));
        });
    });
}

function parseRSSFeed(rssText) {
    // Basic RSS parsing - extract key elements
    const titleMatch = rssText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const descMatch = rssText.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
    const authorMatch = rssText.match(/<itunes:author>(.*?)<\/itunes:author>/);
    const imageMatch = rssText.match(/<itunes:image[^>]*href="([^"]*)"/) || rssText.match(/<image>.*?<url>(.*?)<\/url>.*?<\/image>/s);
    const categoryMatches = rssText.match(/<itunes:category[^>]*text="([^"]*)"/g) || [];

    // Extract episodes
    const itemMatches = rssText.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];
    const episodes = itemMatches.slice(0, 10).map(item => {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        const durationMatch = item.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
        
        return {
            title: titleMatch ? (titleMatch[1] || titleMatch[2] || '') : '',
            description: descMatch ? (descMatch[1] || descMatch[2] || '') : '',
            duration: durationMatch ? durationMatch[1] : ''
        };
    });

    return {
        title: titleMatch ? (titleMatch[1] || titleMatch[2] || '') : '',
        description: descMatch ? (descMatch[1] || descMatch[2] || '') : '',
        author: authorMatch ? authorMatch[1] : '',
        image: imageMatch ? (imageMatch[1] || imageMatch[2] || '') : '',
        categories: categoryMatches.map(cat => {
            const match = cat.match(/text="([^"]*)"/);
            return match ? match[1] : '';
        }).filter(Boolean),
        episode_count: itemMatches.length,
        recent_episodes: episodes
    };
}

function validateRSSFeed(rssData) {
    const errors = [];
    const suggestions = [];
    
    if (!rssData.title) {
        errors.push({
            field: 'title',
            severity: 'error',
            message: 'Missing podcast title',
            recommendation: 'Add a clear, descriptive title to your podcast'
        });
    }
    
    if (!rssData.description || rssData.description.length < 50) {
        suggestions.push({
            field: 'description',
            severity: 'warning',
            message: 'Description is missing or too short',
            recommendation: 'Add a detailed description (150-300 characters) for better discoverability'
        });
    }
    
    if (!rssData.image) {
        errors.push({
            field: 'image',
            severity: 'error',
            message: 'Missing podcast artwork',
            recommendation: 'Add high-quality artwork (1400x1400px minimum) for better platform visibility'
        });
    }
    
    return { errors, suggestions };
}

function calculateSEOScore(rssData, validation) {
    let score = 0;
    if (rssData.title) score += 20;
    if (rssData.description && rssData.description.length >= 150) score += 25;
    if (rssData.image) score += 20;
    if (rssData.categories && rssData.categories.length > 0) score += 15;
    if (rssData.author) score += 10;
    if (rssData.episode_count >= 5) score += 10;
    
    return Math.min(100, score);
}