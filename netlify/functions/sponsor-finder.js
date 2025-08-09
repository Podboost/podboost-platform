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
                    - Health podcasts: Fitness brands, supplements, wellness apps
                    - Business podcasts: Business services, productivity tools, financial services
                    - Comedy podcasts: Entertainment brands, lifestyle products
                    - True crime podcasts: Security services, legal services, documentary platforms

                    Include a mix of:
                    - 40% companies directly relevant to the podcast topic
                    - 30% Australian companies (Afterpay, Canva, etc.) that fit the audience
                    - 30% global brands that match the podcast's demographic

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
                    content: `Analyze this podcast data and find 12 highly relevant sponsors based on the content, topics, and audience demographics. Podcast data: ${podcastData}`
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