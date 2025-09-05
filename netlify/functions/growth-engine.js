const serverless = require('serverless-http');
const express = require('express');
const multer = require('multer');
const Papa = require('papaparse');

const app = express();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Growth engine analysis endpoint
app.post('/api/growth-engine', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvData = req.file.buffer.toString('utf8');
    
    // Parse CSV data
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => {
        // Clean and normalize data
        if (typeof value === 'string') {
          return value.trim();
        }
        return value;
      }
    });

    if (parsed.errors.length > 0) {
      return res.status(400).json({ 
        error: 'CSV parsing failed', 
        details: parsed.errors.map(err => err.message) 
      });
    }

    const data = parsed.data;
    
    if (data.length === 0) {
      return res.status(400).json({ error: 'No data found in CSV file' });
    }

    // Analyze the data
    const analysis = analyzeGrowthData(data);
    
    res.json({
      success: true,
      analysis: analysis,
      rowCount: data.length,
      columns: Object.keys(data[0] || {})
    });

  } catch (error) {
    console.error('Growth engine error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

function analyzeGrowthData(data) {
  const metrics = {
    totalEpisodes: data.length,
    totalDownloads: 0,
    averageDownloads: 0,
    growthTrend: 'stable',
    topPerformingEpisodes: [],
    recommendations: []
  };

  // Find download columns (flexible column name matching)
  const downloadColumns = Object.keys(data[0] || {}).filter(col => 
    col.toLowerCase().includes('download') || 
    col.toLowerCase().includes('plays') || 
    col.toLowerCase().includes('listens')
  );

  if (downloadColumns.length > 0) {
    const downloadCol = downloadColumns[0];
    
    // Calculate total and average downloads
    let totalDownloads = 0;
    let validEntries = 0;
    
    data.forEach(row => {
      const downloads = parseInt(row[downloadCol]) || 0;
      if (downloads > 0) {
        totalDownloads += downloads;
        validEntries++;
      }
    });

    metrics.totalDownloads = totalDownloads;
    metrics.averageDownloads = validEntries > 0 ? Math.round(totalDownloads / validEntries) : 0;

    // Find top performing episodes
    const episodesWithDownloads = data
      .map(row => ({
        title: row.title || row.episode || row.name || 'Unknown Episode',
        downloads: parseInt(row[downloadCol]) || 0
      }))
      .filter(ep => ep.downloads > 0)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 5);

    metrics.topPerformingEpisodes = episodesWithDownloads;

    // Analyze growth trend (simple version)
    if (data.length >= 3) {
      const recent = data.slice(-3).map(row => parseInt(row[downloadCol]) || 0);
      const older = data.slice(0, 3).map(row => parseInt(row[downloadCol]) || 0);
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      
      if (recentAvg > olderAvg * 1.1) {
        metrics.growthTrend = 'growing';
      } else if (recentAvg < olderAvg * 0.9) {
        metrics.growthTrend = 'declining';
      }
    }
  }

  // Generate recommendations
  metrics.recommendations = generateRecommendations(metrics, data);

  return metrics;
}

function generateRecommendations(metrics, data) {
  const recommendations = [];

  if (metrics.averageDownloads < 100) {
    recommendations.push({
      category: 'Growth',
      title: 'Improve Discovery',
      description: 'Your average downloads are below 100. Focus on SEO optimization, social media promotion, and guest appearances.',
      priority: 'high'
    });
  }

  if (metrics.totalEpisodes < 10) {
    recommendations.push({
      category: 'Content',
      title: 'Consistent Publishing',
      description: 'You have fewer than 10 episodes. Maintain a consistent publishing schedule to build audience trust.',
      priority: 'high'
    });
  }

  if (metrics.growthTrend === 'declining') {
    recommendations.push({
      category: 'Performance',
      title: 'Reverse Declining Trend',
      description: 'Your recent episodes show declining performance. Review successful episodes and replicate their format.',
      priority: 'high'
    });
  }

  if (metrics.topPerformingEpisodes.length > 0) {
    const topEpisode = metrics.topPerformingEpisodes[0];
    recommendations.push({
      category: 'Content Strategy',
      title: 'Replicate Success',
      description: `Your top episode "${topEpisode.title}" has ${topEpisode.downloads} downloads. Analyze what made it successful and create similar content.`,
      priority: 'medium'
    });
  }

  recommendations.push({
    category: 'Marketing',
    title: 'Cross-Platform Promotion',
    description: 'Promote your podcast across multiple platforms: social media, email newsletters, and podcast directories.',
    priority: 'medium'
  });

  return recommendations;
}

module.exports.handler = serverless(app);