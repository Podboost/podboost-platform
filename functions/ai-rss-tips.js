const https = require('https');
const http = require('http');
const feedparser = require('feedparser');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { rss_url } = JSON.parse(event.body);
    
    if (!rss_url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'RSS URL is required' })
      };
    }

    console.log('Analyzing RSS feed for growth tips:', rss_url);

    // Parse RSS feed
    const feedData = await new Promise((resolve, reject) => {
      const protocol = rss_url.startsWith('https:') ? https : http;
      const request = protocol.get(rss_url, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to fetch RSS feed: HTTP ${response.statusCode}`));
        }
        
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
        body: JSON.stringify({ error: 'Unable to parse RSS feed' })
      };
    }

    const { feedInfo, episodes } = feedData;

    // Analyze content patterns
    const recentEpisodes = episodes.slice(0, 10);
    const episodeTitles = recentEpisodes.map(ep => ep.title || '').join(' ');
    const allContent = `${feedInfo.title} ${feedInfo.description} ${episodeTitles}`.toLowerCase();

    // Content analysis
    const contentPatterns = {
      interviews: recentEpisodes.filter(ep => 
        /interview|guest|with|talks?|conversation|chat/i.test(ep.title || '')
      ).length,
      lists: recentEpisodes.filter(ep => 
        /\d+.*tips|ways|steps|secrets|rules|habits|mistakes/i.test(ep.title || '')
      ).length,
      questions: recentEpisodes.filter(ep => 
        /\?|how|why|what|when|where|should|can|will/i.test(ep.title || '')
      ).length,
      numbers: episodeTitles.filter(title => /\d+|tips|steps|ways|secrets/i.test(title)).length,
    };

    // Category detection
    let category = 'General';
    const categories = feedInfo.categories || [];
    if (categories.length > 0) {
      category = categories[0]._ || categories[0] || 'General';
    } else {
      // Detect from content
      if (/business|entrepreneur|startup|finance|money|marketing|sales/i.test(allContent)) {
        category = 'Business';
      } else if (/tech|technology|software|coding|programming|ai|digital/i.test(allContent)) {
        category = 'Technology';
      } else if (/health|fitness|wellness|nutrition|mental|mindfulness/i.test(allContent)) {
        category = 'Health & Fitness';
      } else if (/education|learning|teach|academic|school|university/i.test(allContent)) {
        category = 'Education';
      } else if (/comedy|humor|funny|laugh|entertainment/i.test(allContent)) {
        category = 'Comedy';
      } else if (/news|politics|current|events|society|culture/i.test(allContent)) {
        category = 'News & Politics';
      } else if (/sports|football|basketball|soccer|baseball|athletics/i.test(allContent)) {
        category = 'Sports';
      } else if (/kids|children|family|parenting|parent/i.test(allContent)) {
        category = 'Kids & Family';
      }
    }

    // Generate specific tips based on actual podcast data
    const tips = [];
    
    // Episode count based tips
    if (episodes.length < 20) {
      tips.push(`With ${episodes.length} episodes, focus on building publishing consistency to reach at least 20 episodes for better platform visibility.`);
    } else if (episodes.length < 50) {
      tips.push(`Your ${episodes.length} episodes show good momentum. Consider creating series or themed episodes to encourage binge listening.`);
    } else {
      tips.push(`With ${episodes.length} episodes, you have substantial content. Create "best of" compilations and highlight evergreen episodes.`);
    }

    // Check for trailers
    const trailerEpisodes = episodes.filter(ep => 
      /trailer|preview|intro|welcome|about.*podcast/i.test(ep.title || '') ||
      (ep.description && /trailer|preview|intro|about.*podcast/i.test(ep.description))
    );
    
    if (trailerEpisodes.length === 0) {
      tips.push('🚨 CRITICAL: Create a trailer episode immediately! Apple and Spotify prioritize podcasts with trailers in their discovery algorithms.');
    }

    // Interview strategy
    if (contentPatterns.interviews < 3) {
      tips.push(`You have ${contentPatterns.interviews} interview-style episodes out of ${recentEpisodes.length} recent ones. Consider interviewing 2-3 experts monthly in ${category.toLowerCase()} to diversify your content and attract their audiences.`);
    }

    // Content format optimization
    if (contentPatterns.numbers < 2) {
      tips.push(`Only ${contentPatterns.numbers} of your recent episodes use numbered formats. Create "5 Ways to..." or "7 Steps to..." episodes - these perform 40% better in search and social sharing.`);
    }

    // Category-specific recommendations
    if (category === 'Business') {
      tips.push('Analyze your successful episodes and create "Case Study" follow-ups showing real implementation results from your advice.');
    } else if (category === 'Technology') {
      tips.push('Create "Tech News Roundup" episodes covering recent developments in your niche - these often get high engagement.');
    } else if (category === 'Health & Fitness') {
      tips.push('Document your own health journey or feature listener transformation stories for authentic content.');
    }

    // Episode compilation strategy
    if (episodes.length > 50) {
      tips.push(`With ${episodes.length} episodes, create a "Best of 2024" compilation featuring your top 10 most impactful episodes to re-engage past listeners and attract new ones.`);
    }

    // Recent content focus analysis
    const recentTitles = recentEpisodes.slice(0, 5).map(ep => ep.title || '');
    const commonWords = recentTitles.join(' ').toLowerCase().split(' ')
      .filter(word => word.length > 4)
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
    
    const topTopic = Object.entries(commonWords)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topTopic && topTopic[1] > 1) {
      tips.push(`Your recent episodes focus heavily on "${topTopic[0]}". Consider creating a dedicated series or mini-course around this topic to establish authority and improve listener retention.`);
    }

    // Content analysis summary
    const contentAnalysis = `${category} podcast with ${episodes.length} episodes. Recent content patterns: ${contentPatterns.interviews} interviews, ${contentPatterns.lists} list-format episodes, ${contentPatterns.questions} question-based titles. ${recentEpisodes.length > 0 ? `Featured guests include ${recentEpisodes[0].title?.split(' ')[0] || 'your economy'}` : ''}. Average episode title length: ${Math.round(episodeTitles.length / recentEpisodes.length) || 50} characters`;

    // Focus areas
    const focusAreas = [
      'Platform Promotion',
      'Content Curation', 
      'Guest Strategy',
      'Results Tracking'
    ];

    // Audience insights based on category
    let audienceInsights = '';
    if (category === 'Business') {
      audienceInsights = 'professionals and entrepreneurs. Growth strategy: LinkedIn and professional networks. Consider partnering with relevant industry leaders for cross-promotion.';
    } else if (category === 'Technology') {
      audienceInsights = 'tech enthusiasts and professionals. Growth strategy: Twitter, GitHub, and tech communities. Consider featuring open-source projects or tech tutorials.';
    } else if (category === 'Health & Fitness') {
      audienceInsights = 'health-conscious individuals seeking improvement. Growth strategy: Instagram, fitness apps, and wellness communities. Partner with fitness influencers and health brands.';
    } else {
      audienceInsights = 'engaged listeners interested in your niche. Focus on consistent value delivery and community building across social platforms.';
    }

    // RSS optimization checks
    const rssOptimizations = [];
    
    if (trailerEpisodes.length === 0) {
      rssOptimizations.push({
        type: 'critical',
        message: 'No trailer episodes found - Critical for Apple and Spotify promotion',
        recommendation: 'Create a trailer episode immediately! Apple and Spotify use trailers to promote podcasts in search results and recommendations. Mark it with itunes:episodeType="trailer"'
      });
    }

    const response = {
      success: true,
      podcast_info: {
        title: feedInfo.title || 'Unknown Podcast',
        episode_count: episodes.length,
        category: category
      },
      tips: tips,
      content_analysis: contentAnalysis,
      focus_areas: focusAreas,
      optimization_suggestions: [],
      audience_insights: audienceInsights,
      rss_optimizations: rssOptimizations,
      trailer_status: {
        has_trailers: trailerEpisodes.length > 0,
        trailer_count: trailerEpisodes.length,
        potential_trailers: 0,
        critical_warning: trailerEpisodes.length === 0
      },
      analysis: `Analyzed real RSS feed for "${feedInfo.title}" with ${episodes.length} episodes`,
      note: 'Personalized recommendations based on your actual podcast content and RSS structure'
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('RSS tips analysis error:', error);
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