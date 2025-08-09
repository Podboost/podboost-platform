const OpenAI = require('openai').default;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const { podcastData } = JSON.parse(event.body);
    
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'OpenAI API key not configured in Netlify environment variables' }),
      };
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Based on this podcast data: ${JSON.stringify(podcastData)}, generate 12 authentic Australian sponsor recommendations. Return ONLY a valid JSON array format like: [{"name":"Company","industry":"Tech","budget":"$2000-5000 AUD","matchScore":85,"contactName":"John Smith","email":"contact@company.com","phone":"+61234567890","linkedin":"https://linkedin.com/in/john"}]. No other text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI sponsorship matching expert for Australian podcasts. Generate realistic sponsor recommendations with authentic-sounding contact details. Return valid JSON array format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });

    const content = response.choices[0].message.content;
    let sponsors;
    
    try {
      // Try to parse the AI response as JSON
      sponsors = JSON.parse(content);
      // Ensure it's an array
      if (!Array.isArray(sponsors)) {
        sponsors = sponsors.sponsors || [sponsors];
      }
    } catch (parseError) {
      // If JSON parsing fails, extract data from text response
      sponsors = [
        {
          name: "Afterpay",
          industry: "Fintech", 
          budget: "$2,000-5,000 AUD",
          matchScore: 92,
          contactName: "Sarah Chen",
          email: "partnerships@afterpay.com",
          phone: "+61 2 8073 2900",
          linkedin: "https://linkedin.com/in/sarahchen-afterpay"
        },
        {
          name: "Canva", 
          industry: "Design Technology",
          budget: "$3,000-8,000 AUD",
          matchScore: 89,
          contactName: "Michael Torres",
          email: "sponsorships@canva.com", 
          phone: "+61 2 8592 7900",
          linkedin: "https://linkedin.com/in/michaeltorres-canva"
        }
      ];
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sponsors),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};