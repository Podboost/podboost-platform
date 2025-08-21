const { parse } = require('csv-parse/sync');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse multipart form data (simplified for CSV)
    const body = event.body;
    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file uploaded' })
      };
    }

    // Extract CSV content from multipart data
    let csvContent = '';
    try {
      // Simple extraction - look for CSV content after headers
      const lines = body.split('\n');
      let foundData = false;
      for (const line of lines) {
        if (line.includes('Content-Type: text/csv') || line.includes('filename=')) {
          foundData = true;
          continue;
        }
        if (foundData && line.trim() && !line.startsWith('--')) {
          csvContent += line + '\n';
        }
      }
      
      // Fallback: treat entire body as CSV if no multipart detected
      if (!csvContent && body.includes(',')) {
        csvContent = body;
      }
    } catch (e) {
      console.error('Error extracting CSV:', e);
    }

    if (!csvContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid CSV file format' })
      };
    }

    console.log('Processing CSV content...');

    // Parse CSV data
    let records = [];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (parseError) {
      console.error('CSV parsing error:', parseError);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Failed to parse CSV file' })
      };
    }

    if (records.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Empty CSV file' })
      };
    }

    console.log(`Parsed ${records.length} records from CSV`);

    // Analyze the CSV data
    const analysis = analyzeCSVData(records);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        ...analysis
      })
    };

  } catch (error) {
    console.error('CSV analysis error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to analyze CSV data',
        message: error.message 
      })
    };
  }
};

function analyzeCSVData(records) {
  // Detect CSV type and columns
  const columns = Object.keys(records[0] || {});
  console.log('CSV columns:', columns);

  // Common podcast analytics columns
  const downloadColumns = ['downloads', 'total_downloads', 'listens', 'plays', 'unique_downloads'];
  const episodeColumns = ['episode', 'title', 'episode_title', 'name'];
  const dateColumns = ['date', 'publish_date', 'released', 'created_at'];

  // Find relevant columns
  const downloadCol = columns.find(col => 
    downloadColumns.some(dc => col.toLowerCase().includes(dc.toLowerCase()))
  );
  const episodeCol = columns.find(col => 
    episodeColumns.some(ec => col.toLowerCase().includes(ec.toLowerCase()))
  );
  const dateCol = columns.find(col => 
    dateColumns.some(dc => col.toLowerCase().includes(dc.toLowerCase()))
  );

  // Calculate metrics
  let totalDownloads = 0;
  let episodeCount = 0;
  const episodeData = [];

  records.forEach(record => {
    if (downloadCol && record[downloadCol]) {
      const downloads = parseInt(record[downloadCol]) || 0;
      totalDownloads += downloads;
      
      episodeData.push({
        title: record[episodeCol] || `Episode ${episodeCount + 1}`,
        downloads: downloads,
        date: record[dateCol] || 'Unknown'
      });
    }
    episodeCount++;
  });

  // Sort episodes by downloads
  episodeData.sort((a, b) => b.downloads - a.downloads);
  const topPerformers = episodeData.slice(0, 5);

  const averageDownloads = episodeCount > 0 ? Math.round(totalDownloads / episodeCount) : 0;

  // Calculate growth score
  let growthScore = 60; // Base score

  if (averageDownloads > 1000) growthScore += 15;
  else if (averageDownloads > 500) growthScore += 10;
  else if (averageDownloads > 100) growthScore += 5;

  if (episodeCount > 50) growthScore += 10;
  else if (episodeCount > 20) growthScore += 5;

  if (topPerformers.length > 0 && topPerformers[0].downloads > averageDownloads * 2) {
    growthScore += 10; // Has standout episodes
  }

  growthScore = Math.min(100, growthScore);

  // Generate recommendations
  const seoRecommendations = [
    'Optimize episode titles with keywords from your top-performing episodes',
    'Create detailed show notes with timestamps and key topics',
    'Use consistent category tags across all episodes'
  ];

  const contentRecommendations = [];
  if (topPerformers.length > 0) {
    contentRecommendations.push(`Analyze why "${topPerformers[0].title}" performed well and create similar content`);
  }
  contentRecommendations.push(
    'Maintain consistent publishing schedule',
    'Create series-based content to encourage binge listening',
    'Develop shorter teaser episodes for new audience discovery'
  );

  const distributionRecommendations = [
    'Submit to additional podcast directories',
    'Create audiogram clips from your top episodes for social media',
    'Cross-promote with podcasts in similar categories'
  ];

  const audienceInsights = [
    `Your average episode gets ${averageDownloads.toLocaleString()} downloads`,
    'Focus on topics similar to your top-performing episodes',
    'Consider surveying listeners about preferred episode length and topics'
  ];

  const monetizationOpportunities = [
    averageDownloads > 1000 ? 'You have the audience size for premium sponsorships' : 'Focus on growing to 1,000+ downloads for sponsor interest',
    'Create premium content or bonus episodes for subscribers',
    'Develop merchandise based on popular episode themes'
  ];

  const actionItems = [
    {
      priority: 'high',
      title: 'Replicate Success',
      description: `Study why your top episode got ${topPerformers[0]?.downloads || 0} downloads and create similar content`
    },
    {
      priority: 'medium', 
      title: 'Optimize Underperformers',
      description: 'Review episodes with below-average downloads and identify improvement opportunities'
    },
    {
      priority: 'low',
      title: 'Audience Research',
      description: 'Survey listeners about their preferences and pain points'
    }
  ];

  return {
    growth_score: growthScore,
    summary: `Analyzed ${episodeCount} episodes with ${totalDownloads.toLocaleString()} total downloads. Average performance: ${averageDownloads.toLocaleString()} downloads per episode.`,
    metrics: {
      totalEpisodes: episodeCount,
      totalDownloads: totalDownloads,
      averageDownloads: averageDownloads,
      topPerformers: topPerformers,
      recentTrend: totalDownloads > 0 ? 'Data Available' : 'No Data'
    },
    seo_recommendations: seoRecommendations,
    content_recommendations: contentRecommendations,
    distribution_recommendations: distributionRecommendations,
    audience_insights: audienceInsights,
    monetization_opportunities: monetizationOpportunities,
    action_items: actionItems
  };
}