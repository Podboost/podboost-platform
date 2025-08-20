const https = require('https');
const http = require('http');
const url = require('url');

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

        const feedData = await fetchWithRedirects(feedUrl, 5);
        const rssData = parseBasicRSS(feedData);
        const validation = validateBasicRSS(rssData);
        const seoScore = calculateBasicSEO(rssData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                podcast_metadata: rssData,
                feed_validation: validation.errors || [],
                optimization_suggestions: validation.suggestions || [],
                seo_score: seoScore,
                episode_count: rssData.episode_count || 0,
                recent_episodes: rssData.recent_episodes || []
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

async function fetchWithRedirects(feedUrl, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
        }

        const urlObj = new URL(feedUrl);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'PodBoost RSS Checker 1.0'
            }
        };

        const client = urlObj.protocol === 'https:' ? https : http;
        
        const req = client.request(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = url.resolve(feedUrl, res.headers.location);
                fetchWithRedirects(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

function parseBasicRSS(rssText) {
    // Clean up common RSS parsing issues
    const cleanRss = rssText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Extract basic metadata
    const extractContent = (pattern) => {
        const match = cleanRss.match(pattern);
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
    let image = '';
    const imageMatch = cleanRss.match(/<itunes:image[^>]*href=["']([^"']*)/i) || 
                      cleanRss.match(/<image[^>]*>.*?<url[^>]*>(.*?)<\/url>/si);
    if (imageMatch) {
        image = imageMatch[1];
    }

    // Extract categories
    const categoryMatches = cleanRss.match(/<itunes:category[^>]*text=["']([^"']*)/gi) || [];
    const categories = categoryMatches.map(cat => {
        const match = cat.match(/text=["']([^"']*)/i);
        return match ? match[1] : '';
    }).filter(Boolean);

    // Extract episodes
    const episodes = [];
    const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let itemMatch;
    let count = 0;
    
    while ((itemMatch = itemPattern.exec(cleanRss)) && count < 10) {
        const itemContent = itemMatch[1];
        const epTitle = extractItemContent(itemContent, /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
        const epDesc = extractItemContent(itemContent, /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i);
        const epDuration = extractItemContent(itemContent, /<itunes:duration[^>]*>(.*?)<\/itunes:duration>/i);
        const epDate = extractItemContent(itemContent, /<pubDate[^>]*>(.*?)<\/pubDate>/i);
        
        if (epTitle) {
            episodes.push({
                title: epTitle,
                description: epDesc.substring(0, 200),
                duration: epDuration,
                publish_date: epDate
            });
            count++;
        }
    }

    return {
        title: title || 'Unknown Podcast',
        description: description,
        author: author,
        language: language || 'en',
        image: image,
        categories: categories,
        episode_count: episodes.length,
        recent_episodes: episodes
    };
}

function extractItemContent(itemContent, pattern) {
    const match = itemContent.match(pattern);
    if (match) {
        const content = match[1] || match[2] || '';
        return content.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim();
    }
    return '';
}

function validateBasicRSS(rssData) {
    const errors = [];
    const suggestions = [];
    
    if (!rssData.title || rssData.title === 'Unknown Podcast') {
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
            recommendation: 'Add a detailed description (150+ characters) for better discoverability'
        });
    }
    
    if (!rssData.image) {
        errors.push({
            field: 'image',
            severity: 'error',
            message: 'Missing podcast artwork',
            recommendation: 'Add high-quality artwork (1400x1400px minimum)'
        });
    }
    
    if (!rssData.categories || rssData.categories.length === 0) {
        suggestions.push({
            field: 'categories',
            severity: 'warning',
            message: 'No categories specified',
            recommendation: 'Add relevant iTunes categories to improve discoverability'
        });
    }
    
    return { errors, suggestions };
}

function calculateBasicSEO(rssData) {
    let score = 0;
    if (rssData.title && rssData.title !== 'Unknown Podcast') score += 25;
    if (rssData.description && rssData.description.length >= 100) score += 25;
    if (rssData.image) score += 20;
    if (rssData.categories && rssData.categories.length > 0) score += 15;
    if (rssData.author) score += 10;
    if (rssData.episode_count >= 3) score += 5;
    
    return Math.min(100, score);
}