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

        const feedData = await fetchAndParseRSS(feedUrl);
        const growthAnalysis = generateGrowthAnalysis(feedData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                podcast_metadata: {
                    title: feedData.title,
                    episode_count: feedData.episode_count,
                    latest_episode: feedData.latest_episode
                },
                growth_score: growthAnalysis.score,
                summary: growthAnalysis.summary,
                seo_recommendations: growthAnalysis.seo,
                content_recommendations: growthAnalysis.content,
                distribution_recommendations: growthAnalysis.distribution,
                action_items: growthAnalysis.actions
            })
        };

    } catch (error) {
        console.error('RSS growth analysis error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to analyze RSS for growth',
                details: error.message 
            })
        };
    }
};

async function fetchAndParseRSS(feedUrl) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(feedUrl);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'PodBoost Growth Engine 1.0'
            }
        };

        const req = client.request(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = url.resolve(feedUrl, res.headers.location);
                return fetchAndParseRSS(redirectUrl).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const feedData = parseBasicRSS(data);
                    resolve(feedData);
                } catch (parseError) {
                    reject(parseError);
                }
            });
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
    
    // Count episodes
    const episodeMatches = rssText.match(/<item[^>]*>/gi) || [];
    const episodeCount = episodeMatches.length;
    
    // Get latest episode
    const latestEpisodeMatch = rssText.match(/<item[^>]*>([\s\S]*?)<\/item>/i);
    let latestEpisode = 'None';
    if (latestEpisodeMatch) {
        const itemContent = latestEpisodeMatch[1];
        latestEpisode = extractContent(itemContent.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i) || ['', '']);
    }

    return {
        title: title || 'Unknown Podcast',
        description,
        episode_count: episodeCount,
        latest_episode: latestEpisode
    };
}

function generateGrowthAnalysis(feedData) {
    const episodeCount = feedData.episode_count;
    
    // Calculate growth score
    let score = 50; // Base score
    if (episodeCount > 50) score += 30;
    else if (episodeCount > 20) score += 20;
    else if (episodeCount > 10) score += 10;
    
    if (feedData.title && feedData.title !== 'Unknown Podcast') score += 10;
    if (feedData.description && feedData.description.length > 100) score += 10;
    
    return {
        score: Math.min(100, score),
        summary: `Your podcast "${feedData.title}" shows good growth potential with ${episodeCount} episodes published.`,
        seo: [
            "Optimize episode titles with relevant keywords",
            "Include detailed show notes for each episode",
            "Add consistent category tags across episodes"
        ],
        content: [
            "Maintain consistent publishing schedule",
            "Create series or themed episodes for better discovery",
            "Include clear calls-to-action in episodes"
        ],
        distribution: [
            "Submit to all major podcast directories",
            "Cross-promote on social media platforms",
            "Consider YouTube for video versions"
        ],
        actions: [
            `Current library of ${episodeCount} episodes provides ${episodeCount < 20 ? 'foundation for growth' : 'substantial content depth'}`,
            "Focus on consistent weekly publishing for audience retention",
            "Optimize episode descriptions with relevant keywords"
        ]
    };
}