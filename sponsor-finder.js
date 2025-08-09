const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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
        const { podcastData } = JSON.parse(event.body);
        
        if (!process.env.OPENAI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'OpenAI API key not configured' })
            };
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert sponsorship consultant specializing in personalized podcast sponsor matching. Analyze the podcast data provided and generate sponsors that are specifically relevant to this podcast's content, audience, and themes.

                    IMPORTANT: Generate sponsors that match the podcast's specific content. For example:
                    - Tech podcasts: Software companies, tech startups, developer tools
                    Analyze the ACTUAL podcast content and themes provided to find sponsors that match:
                    
                    Based on content themes: ${podcastData.content_themes || 'Not provided'}
                    Primary topics discussed: ${podcastData.primary_topics || 'Not provided'}
                    Episode examples: ${podcastData.top_episodes?.map(ep => ep.title).slice(0,3).join(', ') || 'Not provided'}
                    Geographic focus: ${podcastData.geographic_focus || 'Global'}
                    Average downloads: ${podcastData.average_downloads || 'Not provided'}
                    
                    Find sponsors specifically relevant to these actual content themes:
                    - Tech content: Software companies, SaaS tools, development platforms
                    - Health content: Fitness apps, nutrition brands, wellness services
                    - Business content: Business tools, financial services, productivity apps
                    - Lifestyle content: Consumer brands, subscription boxes, lifestyle services
                    - Entertainment: Streaming platforms, gaming companies, media services
                    
                    Make recommendations highly specific to the analyzed content, not generic Australian companies.

                    Return ONLY valid JSON in this exact format:
                    {
                        "sponsors": [
                            {
                                "company": "Company Name",
                                "description": "Brief description of why this company matches the podcast",
                                "contact_name": "Contact Person",
                                "contact_title": "Marketing Director",
                                "contact_email": "name@company.com",
                                "phone": "+61 X XXXX XXXX",
                                "linkedin": "https://linkedin.com/in/contact",
                                "match_score": 85,
                                "budget": "$2,000-5,000 AUD",
                                "category": "Specific industry category"
                            }
                        ]
                    }`
                },
                {
                    role: "user", 
                    content: `Analyze this REAL podcast data and find 12 highly personalized sponsors based on actual content themes and topics:

Podcast Data: ${podcastData}

Requirements:
1. Use the actual content themes and topics provided
2. Match sponsors to specific episode content and discussions
3. Consider the geographic market and audience demographics
4. Provide sponsors that align with the podcast's actual subject matter
5. Explain WHY each sponsor matches based on the content analysis

Generate sponsors that would genuinely want to advertise on this specific podcast based on its content.`
                }
            ],
            max_tokens: 3000,
            temperature: 0.8
        });

        const result = JSON.parse(completion.choices[0].message.content);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('OpenAI error:', error);
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