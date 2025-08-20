// RSS Growth Analysis with proper SSL handling
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

        const feedData = await fetchRSSFeed(feedUrl);
        const rssData = parseRSSForGrowth(feedData);
        const growthAnalysis = generateGrowthAnalysis(rssData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                podcast_metadata: {
                    title: rssData.title,
                    episode_count: rssData.episode_count,
                    latest_episode: rssData.latest_episode
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

async function fetchRSSFeed(feedUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(feedUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'PodBoost Growth Engine 1.0',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        };

        // Configure SSL options to be more permissive
        if (isHttps) {
            options.rejectUnauthorized = false;
            options.secureProtocol = 'TLSv1_2_method';
        }

        const request = client.request(options, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = url.resolve(feedUrl, response.headers.location);
                return fetchRSSFeed(redirectUrl).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }

            let data = '';
            response.setEncoding('utf8');
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        });

        request.on('error', (error) => {
            // Try HTTP fallback for HTTPS errors
            if (isHttps && feedUrl.startsWith('https://')) {
                const httpUrl = feedUrl.replace('https://', 'http://');
                console.log('HTTPS failed, trying HTTP:', httpUrl);
                return fetchRSSFeed(httpUrl).then(resolve).catch(reject);
            }
            reject(error);
        });

        request.setTimeout(15000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });

        request.end();
    });
}

function parseRSSForGrowth(rssText) {
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
        const titleMatch = itemContent.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) {
            latestEpisode = (titleMatch[1] || titleMatch[2] || '').replace(/<[^>]*>/g, '').trim();
        }
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
    
    // Calculate growth score based on episode count and content quality
    let score = 50; // Base score
    if (episodeCount > 100) score += 35;
    else if (episodeCount > 50) score += 30;
    else if (episodeCount > 20) score += 20;
    else if (episodeCount > 10) score += 10;
    
    if (feedData.title && feedData.title !== 'Unknown Podcast') score += 10;
    if (feedData.description && feedData.description.length > 100) score += 10;
    
    return {
        score: Math.min(100, score),
        summary: `Your podcast "${feedData.title}" shows ${episodeCount > 50 ? 'strong' : episodeCount > 20 ? 'good' : 'developing'} growth potential with ${episodeCount} episodes published.`,
        seo: [
            "Optimize episode titles with relevant keywords for better search discovery",
            "Include detailed show notes with timestamps for each episode",
            "Add consistent category tags across all episodes",
            episodeCount < 20 ? "Build episode library to 20+ episodes for algorithm preference" : "Maintain consistent weekly publishing schedule"
        ],
        content: [
            "Create series or themed episodes to improve binge-listening potential",
            "Include clear calls-to-action in episodes to drive engagement",
            episodeCount > 50 ? "Analyze your top-performing episodes and replicate successful content patterns" : "Focus on consistent content themes to build audience expectations",
            "Add episode transcripts to improve accessibility and SEO"
        ],
        distribution: [
            "Submit to all major podcast directories (Apple, Spotify, Google, etc.)",
            "Cross-promote episodes on social media with audiograms",
            "Consider YouTube for video versions to reach broader audience",
            episodeCount > 30 ? "Explore podcast advertising networks for monetization" : "Focus on organic growth through social sharing"
        ],
        actions: [
            `Current library of ${episodeCount} episodes ${episodeCount < 20 ? 'provides foundation for growth - aim for 20+ episodes' : episodeCount < 50 ? 'shows good consistency - target 50+ for sponsor appeal' : 'demonstrates substantial content depth for monetization opportunities'}`,
            "Analyze your podcast analytics to identify peak listening times for optimal publishing",
            episodeCount > 10 ? "Create a content calendar to maintain consistent publishing schedule" : "Focus on establishing regular publishing rhythm",
            "Engage with your audience through social media and email newsletters to build community"
        ]
    };
}