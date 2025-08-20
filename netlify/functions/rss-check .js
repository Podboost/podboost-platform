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
    
    const episodes = [];
    const itemMatches = rssText.match(/<item>.*?<\/item>/gs) || [];
    
    itemMatches.forEach((item, index) => {
        if (index < 5) { // Only analyze first 5 episodes
            const epTitle = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
            const epDesc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
            const epDuration = item.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
            
            episodes.push({
                title: epTitle ? (epTitle[1] || epTitle[2] || '').replace(/<[^>]*>/g, '') : 'Untitled',
                description: epDesc ? (epDesc[1] || epDesc[2] || '').replace(/<[^>]*>/g, '').substring(0, 200) : '',
                duration: epDuration ? epDuration[1] : null
            });
        }
    });

    return {
        title: titleMatch ? (titleMatch[1] || titleMatch[2] || '').replace(/<[^>]*>/g, '') : 'Unknown',
        description: descMatch ? (descMatch[1] || descMatch[2] || '').replace(/<[^>]*>/g, '') : '',
        author: authorMatch ? authorMatch[1] : 'Unknown',
        image: imageMatch ? imageMatch[1] : null,
        categories: categoryMatches.map(cat => cat.match(/text="([^"]*)"/)?.[1]).filter(Boolean),
        episode_count: itemMatches.length,
        recent_episodes: episodes
    };
}

function validateRSSFeed(rssData) {
    const issues = [];

    // Title validation
    if (!rssData.title || rssData.title === 'Unknown') {
        issues.push({
            type: 'missing_title',
            severity: 'error',
            message: 'Podcast title is missing',
            recommendation: 'Add a clear, descriptive title for your podcast'
        });
    } else if (rssData.title.length < 10) {
        issues.push({
            type: 'short_title',
            severity: 'warning',
            message: 'Podcast title is very short',
            recommendation: 'Consider a more descriptive title (10+ characters recommended)'
        });
    }

    // Description validation
    if (!rssData.description) {
        issues.push({
            type: 'missing_description',
            severity: 'error',
            message: 'Podcast description is missing',
            recommendation: 'Add a compelling description to attract listeners'
        });
    } else if (rssData.description.length < 50) {
        issues.push({
            type: 'short_description',
            severity: 'warning',
            message: 'Podcast description is too short',
            recommendation: 'Expand description to 100+ characters for better discoverability'
        });
    }

    // Author validation
    if (!rssData.author || rssData.author === 'Unknown') {
        issues.push({
            type: 'missing_author',
            severity: 'warning',
            message: 'Author information is missing',
            recommendation: 'Add author/creator information for credibility'
        });
    }

    // Image validation
    if (!rssData.image) {
        issues.push({
            type: 'missing_artwork',
            severity: 'error',
            message: 'Podcast artwork is missing',
            recommendation: 'Add high-quality artwork (1400x1400 pixels recommended)'
        });
    }

    // Categories validation
    if (rssData.categories.length === 0) {
        issues.push({
            type: 'missing_categories',
            severity: 'warning',
            message: 'No podcast categories specified',
            recommendation: 'Add relevant iTunes categories for better discoverability'
        });
    }

    // Episode validation
    if (rssData.episode_count === 0) {
        issues.push({
            type: 'no_episodes',
            severity: 'error',
            message: 'No episodes found in feed',
            recommendation: 'Publish at least one episode before launching'
        });
    }

    return issues;
}

function calculateSEOScore(rssData, validation) {
    let score = 100;
    
    validation.forEach(issue => {
        if (issue.severity === 'error') {
            score -= 20;
        } else if (issue.severity === 'warning') {
            score -= 10;
        }
    });

    // Bonus points for good practices
    if (rssData.description && rssData.description.length > 100) score += 5;
    if (rssData.categories && rssData.categories.length >= 2) score += 5;
    if (rssData.episode_count >= 3) score += 5;

    return Math.max(0, Math.min(100, score));
}