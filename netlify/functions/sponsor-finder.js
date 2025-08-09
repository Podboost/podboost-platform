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
                    content: `You are an expert sponsorship consultant. Generate 12 authentic Australian companies that would be good sponsors for this podcast. Include real companies like Afterpay, Canva, Xero, HelloFresh, Woolworths, etc. 

                    Return ONLY valid JSON in this exact format:
                    {
                        "sponsors": [
                            {
                                "name": "Company Name",
                                "contact": "name@company.com",
                                "phone": "+61 X XXXX XXXX",
                                "match_score": 85,
                                "budget_range": "$2,000-5,000 AUD",
                                "category": "Business/Health/Tech"
                            }
                        ]
                    }`
                },
                {
                    role: "user",
                    content: `Find sponsors for this podcast: ${podcastData}`
                }
            ],
            max_tokens: 2000,
            temperature: 0.7
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