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
        const { csvData } = JSON.parse(event.body);
        
        if (!csvData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'CSV data is required' })
            };
        }

        // Parse CSV data
        const rows = csvData.split('\n').map(row => row.split(','));
        const headers_row = rows[0];
        const data = rows.slice(1).filter(row => row.length > 1);

        // Analyze the data
        const analysis = analyzeCSVData(data, headers_row);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(analysis)
        };
    } catch (error) {
        console.error('CSV Analysis Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to analyze CSV data',
                details: error.message 
            })
        };
    }
};

function analyzeCSVData(data, headers) {
    // Find download column
    const downloadCol = findColumnIndex(headers, ['downloads', 'download', 'listens', 'plays']);
    const titleCol = findColumnIndex(headers, ['title', 'episode', 'name']);
    const dateCol = findColumnIndex(headers, ['date', 'published', 'release']);

    if (downloadCol === -1) {
        throw new Error('Could not find download/listens column in CSV');
    }

    // Process episodes
    const episodes = data.map((row, index) => ({
        title: titleCol !== -1 ? row[titleCol] : `Episode ${index + 1}`,
        downloads: parseInt(row[downloadCol]) || 0,
        date: dateCol !== -1 ? row[dateCol] : null
    })).filter(ep => ep.downloads > 0);

    // Calculate metrics
    const totalEpisodes = episodes.length;
    const totalDownloads = episodes.reduce((sum, ep) => sum + ep.downloads, 0);
    const averageDownloads = totalDownloads / totalEpisodes;

    // Sort episodes by downloads
    const sortedEpisodes = episodes.sort((a, b) => b.downloads - a.downloads);
    const topEpisodes = sortedEpisodes.slice(0, 10);

    // Calculate growth trend
    const recentTrend = calculateTrend(episodes);

    // Generate weekly engagement pattern (simulated)
    const weeklyEngagement = [65, 78, 82, 88, 92, 85, 70]; // Sample data

    // Generate hourly engagement pattern (simulated)
    const hourlyEngagement = Array.from({length: 24}, (_, i) => {
        // Peak hours simulation: morning (8-10) and evening (18-20)
        if (i >= 8 && i <= 10) return 80 + Math.random() * 20;
        if (i >= 18 && i <= 20) return 85 + Math.random() * 15;
        if (i >= 12 && i <= 14) return 70 + Math.random() * 15; // Lunch peak
        return 30 + Math.random() * 40;
    });

    // Generate insights
    const engagementInsights = generateInsights(episodes, averageDownloads);

    // Generate growth score
    const growthScore = calculateGrowthScore(episodes, averageDownloads, recentTrend);

    return {
        totalEpisodes,
        totalDownloads,
        averageDownloads: Math.round(averageDownloads),
        recentTrend,
        topEpisodes: topEpisodes.slice(0, 5),
        weeklyEngagement,
        hourlyEngagement,
        engagementInsights,
        growthScore,
        seo_optimization: [
            'Optimize episode titles with relevant keywords',
            'Include detailed show notes for each episode',
            'Use consistent episode numbering and formatting'
        ],
        content_strategy: [
            'Focus on topics from your highest-performing episodes',
            'Maintain consistent episode length and quality',
            'Consider creating series around popular themes'
        ],
        distribution: [
            'Submit to all major podcast directories',
            'Cross-promote episodes on social media',
            'Create audiogram clips for better engagement'
        ],
        audience_insights: [
            `Your average episode gets ${Math.round(averageDownloads).toLocaleString()} downloads`,
            `Top ${Math.round(topEpisodes.length * 0.2)} episodes drive ${Math.round(topEpisodes.slice(0, Math.round(topEpisodes.length * 0.2)).reduce((sum, ep) => sum + ep.downloads, 0) / totalDownloads * 100)}% of total downloads`,
            'Consider surveying your audience for content preferences'
        ],
        monetization_opportunities: [
            'Explore sponsorship opportunities for high-performing episodes',
            'Consider premium content for top topics',
            'Develop merchandise around popular episode themes'
        ],
        action_items: [
            {
                priority: 'high',
                title: 'Content Optimization',
                description: 'Focus on replicating your top-performing content themes',
                opportunities: topEpisodes.slice(0, 3).map(ep => `"${ep.title}" - ${ep.downloads.toLocaleString()} downloads`)
            },
            {
                priority: 'medium',
                title: 'Publishing Consistency',
                description: 'Maintain regular publishing schedule to build audience expectations'
            },
            {
                priority: 'low',
                title: 'Cross-Promotion',
                description: 'Promote successful episodes across different channels'
            }
        ]
    };
}

function findColumnIndex(headers, possibleNames) {
    for (let name of possibleNames) {
        const index = headers.findIndex(header => 
            header.toLowerCase().includes(name.toLowerCase())
        );
        if (index !== -1) return index;
    }
    return -1;
}

function calculateTrend(episodes) {
    if (episodes.length < 2) return 'N/A';
    
    const recent = episodes.slice(-Math.min(5, episodes.length));
    const older = episodes.slice(0, Math.min(5, episodes.length));
    
    const recentAvg = recent.reduce((sum, ep) => sum + ep.downloads, 0) / recent.length;
    const olderAvg = older.reduce((sum, ep) => sum + ep.downloads, 0) / older.length;
    
    const growth = ((recentAvg - olderAvg) / olderAvg * 100);
    return growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
}

function generateInsights(episodes, avgDownloads) {
    const insights = [];
    
    // Performance insights
    const topPerformer = episodes.reduce((max, ep) => ep.downloads > max.downloads ? ep : max, episodes[0]);
    insights.push(`Your top episode "${topPerformer.title}" has ${topPerformer.downloads.toLocaleString()} downloads`);
    
    // Consistency insights
    const aboveAverage = episodes.filter(ep => ep.downloads > avgDownloads).length;
    const percentage = Math.round(aboveAverage / episodes.length * 100);
    insights.push(`${percentage}% of your episodes perform above average`);
    
    // Growth insights
    if (episodes.length >= 10) {
        const firstHalf = episodes.slice(0, Math.floor(episodes.length / 2));
        const secondHalf = episodes.slice(Math.floor(episodes.length / 2));
        const firstAvg = firstHalf.reduce((sum, ep) => sum + ep.downloads, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, ep) => sum + ep.downloads, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg) {
            insights.push('Your podcast shows positive growth trajectory over time');
        }
    }
    
    return insights;
}

function calculateGrowthScore(episodes, avgDownloads, trend) {
    let score = 50; // Base score
    
    // Episode count bonus
    if (episodes.length > 50) score += 20;
    else if (episodes.length > 20) score += 15;
    else if (episodes.length > 10) score += 10;
    
    // Average downloads bonus
    if (avgDownloads > 10000) score += 20;
    else if (avgDownloads > 5000) score += 15;
    else if (avgDownloads > 1000) score += 10;
    else if (avgDownloads > 500) score += 5;
    
    // Trend bonus
    if (trend.includes('+')) {
        const trendValue = parseFloat(trend.replace('+', ''));
        score += Math.min(trendValue / 2, 10);
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
}