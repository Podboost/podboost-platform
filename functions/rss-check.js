const { parse } = require('rss-to-json');

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { rssUrl } = JSON.parse(event.body);
        
        if (!rssUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'RSS URL is required' })
            };
        }

        // Parse the RSS feed
        const feed = await parse(rssUrl);
        
        // Analyze the feed
        const analysis = analyzeFeed(feed);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(analysis)
        };
    } catch (error) {
        console.error('RSS Check Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to parse RSS feed',
                details: error.message 
            })
        };
    }
};

function analyzeFeed(feed) {
    const issues = [];
    const suggestions = [];
    let seoScore = 100;

    // Check basic elements
    if (!feed.title) {
        issues.push('Missing podcast title');
        seoScore -= 20;
    }

    if (!feed.description) {
        issues.push('Missing podcast description');
        seoScore -= 15;
    }

    if (!feed.image) {
        issues.push('Missing podcast artwork');
        seoScore -= 15;
    }

    // Check episode count
    const episodeCount = feed.items ? feed.items.length : 0;
    if (episodeCount === 0) {
        issues.push('No episodes found');
        seoScore -= 30;
    }

    // Generate suggestions
    if (feed.description && feed.description.length < 100) {
        suggestions.push('Consider expanding your podcast description for better discoverability');
    }

    if (episodeCount > 0 && episodeCount < 5) {
        suggestions.push('Having more episodes can improve your podcast\'s discoverability');
    }

    // Check for recent episodes
    if (feed.items && feed.items.length > 0) {
        const latestEpisode = new Date(feed.items[0].published);
        const daysSinceLatest = (Date.now() - latestEpisode.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLatest > 30) {
            suggestions.push('Regular publishing schedule helps maintain audience engagement');
        }
    }

    return {
        feed: {
            title: feed.title || 'Unknown',
            description: feed.description || 'No description',
            image: feed.image || null,
            author: feed.author || 'Unknown',
            episodeCount: episodeCount,
            language: feed.language || 'Not specified'
        },
        seoScore: Math.max(0, seoScore),
        issues: issues,
        suggestions: suggestions,
        recentEpisodes: feed.items ? feed.items.slice(0, 5).map(item => ({
            title: item.title,
            published: item.published,
            description: item.description ? item.description.substring(0, 200) + '...' : 'No description'
        })) : []
    };
}