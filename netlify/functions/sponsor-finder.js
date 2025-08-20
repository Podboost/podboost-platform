const OpenAI = require('openai');

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
        let podcastData;
        
        // Handle both JSON and FormData requests (matching your Replit implementation)
        if (event.headers['content-type']?.includes('multipart/form-data')) {
            // Handle CSV file upload from frontend - simulate CSV analysis like in Replit
            console.log('Processing CSV file upload');
            
            podcastData = {
                content_themes: ['Technology', 'Business', 'Innovation'],
                episodeTitles: ['Tech Innovation', 'Business Growth', 'Digital Transformation'],
                totalEpisodes: 50,
                averageDuration: 35,
                geographic_focus: 'AU'
            };
        } else {
            // Handle direct JSON requests
            const requestBody = JSON.parse(event.body);
            podcastData = requestBody.podcastData || requestBody;
        }
        
        if (!process.env.OPENAI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'OpenAI API key not configured' })
            };
        }

        // Use OpenAI exactly like your Replit implementation
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Analyze this podcast content and generate 12 personalized sponsor recommendations:

Podcast Analysis:
- Episode Titles: ${podcastData.episodeTitles?.slice(0, 5).join(', ') || 'Tech Innovation, Business Growth'}
- Content Themes: ${podcastData.content_themes?.join(', ') || 'Technology, Business'}
- Total Episodes: ${podcastData.totalEpisodes || 50}
- Average Duration: ${podcastData.averageDuration || 35} minutes

Generate authentic Australian companies that would be perfect sponsors for this podcast content. Include companies like Afterpay, Canva, Atlassian, Koala, Woolworths, SEEK, JB Hi-Fi, Xero, etc.

Return JSON in this EXACT format:
{
  "sponsors": [
    {
      "company": "Company Name",
      "description": "Why this company matches the podcast content perfectly",
      "contact_name": "Contact Person",
      "contact_title": "Job Title",
      "contact_email": "email@company.com",
      "phone": "+61 X XXXX XXXX",
      "linkedin": "https://linkedin.com/in/contact",
      "match_score": 85,
      "budget": "$X,000-Y,000 AUD",
      "category": "Industry Category"
    }
  ]
}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an AI sponsorship matching expert for Australian podcasts. Generate realistic sponsor recommendations with authentic-sounding contact details for real Australian companies."
                },
                {
                    role: "user", 
                    content: prompt
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 2500,
            temperature: 0.7
        });

        const result = JSON.parse(response.choices[0].message.content);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Sponsor finder error:', error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to generate sponsors',
                details: error.message 
            })
        };
    }
};