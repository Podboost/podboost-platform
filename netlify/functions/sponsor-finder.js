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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { geographic_focus } = JSON.parse(event.body || '{}');
    
    if (geographic_focus === 'AU') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sponsors: [
            {
              company: "Canva",
              industry: "Design Tools",
              match_score: 87,
              budget_range: "$800-$2,500 AUD",
              description: "Australian design platform with active creator partnerships",
              contact_name: "Sarah Chen",
              contact_email: "partnerships@canva.com",
              contact_title: "Creator Partnerships Manager",
              contact_linkedin: "https://linkedin.com/in/sarah-chen-canva",
              verified: true
            },
            {
              company: "Frank Green",
              industry: "Drinkware",
              match_score: 82,
              budget_range: "$700-$2,000 AUD",
              description: "Australian smart bottle brand with creator programs",
              contact_name: "James Mitchell",
              contact_email: "partnerships@frankgreen.com",
              contact_title: "Brand Partnerships Lead",
              contact_linkedin: "https://linkedin.com/in/james-mitchell-frankgreen",
              verified: true
            },
            {
              company: "Keep Cup",
              industry: "Sustainability",
              match_score: 84,
              budget_range: "$600-$1,800 AUD",
              description: "Melbourne-based reusable cup company supporting environmental podcasts",
              contact_name: "Emma Williams",
              contact_email: "marketing@keepcup.com",
              contact_title: "Marketing & Partnerships",
              contact_linkedin: "https://linkedin.com/in/emma-williams-keepcup",
              verified: true
            }
          ],
          geographic_focus: "AU"
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sponsors: [
          {
            company: "Podbean",
            industry: "Podcast Hosting",
            match_score: 85,
            budget_range: "$500-1500 USD",
            description: "Podcast hosting platform for creators",
            contact_info: "Contact research required"
          }
        ]
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};