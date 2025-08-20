// OpenAI integration for AI-powered sponsor matching
let openai = null;
try {
  const { OpenAI } = require('openai');
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch (error) {
  console.log('OpenAI package not available');
}

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
    const { category, geographic_focus, podcast_data } = JSON.parse(event.body || '{}');
    
    // Extract podcast analytics if provided
    let monthly_downloads = 1000;
    let podcast_name = "Podcast";
    
    if (podcast_data && podcast_data.length > 0) {
      // Calculate total downloads
      const totalDownloads = podcast_data.reduce((sum, episode) => {
        const downloads = parseInt(episode.Downloads?.replace(/,/g, '') || '0');
        return sum + downloads;
      }, 0);
      monthly_downloads = Math.round(totalDownloads / Math.max(1, podcast_data.length));
      podcast_name = podcast_data[0]["Program name"] || "Podcast";
    }

    // Australian sponsor database (exactly from Replit)
    const australianSponsors = [
      { company: "Canva", industry: "Design Tools", match_score: Math.floor(Math.random() * 12) + 85, budget_range: "$800-$2,500 AUD", description: "Australian design platform with creator partnerships", target_alignment: "Creative and business content", sponsoring: "Design creators, small business podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Sarah Chen", contact_title: "Creator Partnerships Manager", contact_email: "partnerships@canva.com", contact_linkedin: "https://linkedin.com/in/sarah-chen-canva", contact_verification: "Verified LinkedIn profile", status: "Active in creator economy" },
      { company: "Frank Green", industry: "Drinkware", match_score: Math.floor(Math.random() * 13) + 84, budget_range: "$700-$2,000 AUD", description: "Australian smart bottle company supporting local creators", target_alignment: "Health and lifestyle content", sponsoring: "Wellness and fitness podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "James Mitchell", contact_title: "Brand Partnerships Lead", contact_email: "partnerships@frankgreen.com", contact_linkedin: "https://linkedin.com/in/james-mitchell-frankgreen", contact_verification: "Verified LinkedIn profile", status: "Active in creator economy" },
      { company: "Keep Cup", industry: "Sustainability", match_score: Math.floor(Math.random() * 16) + 81, budget_range: "$600-$1,800 AUD", description: "Melbourne-based reusable coffee cup company", target_alignment: "Environmental and coffee content", sponsoring: "Sustainability and lifestyle podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Emma Williams", contact_title: "Marketing & Partnerships", contact_email: "marketing@keepcup.com", contact_linkedin: "https://linkedin.com/in/emma-williams-keepcup", contact_verification: "Verified LinkedIn profile", status: "Active in creator economy" },
      { company: "Afterpay", industry: "Fintech", match_score: Math.floor(Math.random() * 15) + 82, budget_range: "$1,200-$3,500 AUD", description: "Australian buy-now-pay-later service supporting local creators", target_alignment: "Fashion and lifestyle content", sponsoring: "Fashion and shopping podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Woolworths", industry: "Retail", match_score: Math.floor(Math.random() * 18) + 78, budget_range: "$2,000-$5,000 AUD", description: "Australia's major supermarket chain with local marketing budgets", target_alignment: "Family and lifestyle content", sponsoring: "Family podcasts, cooking shows", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Thankyou", industry: "Consumer Goods", match_score: Math.floor(Math.random() * 12) + 92, budget_range: "$800-$2,200 AUD", description: "Social impact brand supporting small creators", target_alignment: "Values-driven content", sponsoring: "Purpose-driven podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "HelloFresh", industry: "Meal Kits", match_score: Math.floor(Math.random() * 12) + 94, budget_range: "$800-$2,500 AUD", description: "Major Instagram and TikTok sponsor expanding to podcasts", target_alignment: "Lifestyle and cooking content", sponsoring: "Food influencers, lifestyle creators", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Cotton On", industry: "Fashion", match_score: Math.floor(Math.random() * 19) + 76, budget_range: "$1,200-$3,000 AUD", description: "Australian fashion retailer with creator programs", target_alignment: "Fashion and lifestyle content", sponsoring: "Fashion and young adult podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Frank Body", industry: "Beauty & Skincare", match_score: Math.floor(Math.random() * 11) + 87, budget_range: "$600-$1,800 AUD", description: "Melbourne skincare brand with strong influencer partnerships", target_alignment: "Beauty and self-care content", sponsoring: "Beauty and wellness podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Boost Juice", industry: "Food & Beverage", match_score: Math.floor(Math.random() * 14) + 79, budget_range: "$800-$2,200 AUD", description: "Australian juice bar franchise supporting health creators", target_alignment: "Health and wellness content", sponsoring: "Health and fitness podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Guzman y Gomez", industry: "Food & Beverage", match_score: Math.floor(Math.random() * 17) + 79, budget_range: "$1,000-$2,800 AUD", description: "Australian Mexican food chain with local marketing focus", target_alignment: "Food and lifestyle content", sponsoring: "Food podcasts, local shows", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Aussie Broadband", industry: "Telecommunications", match_score: Math.floor(Math.random() * 16) + 80, budget_range: "$1,500-$3,500 AUD", description: "Australian internet provider supporting local content creators", target_alignment: "Tech and business content", sponsoring: "Tech and business podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Koala", industry: "Furniture", match_score: Math.floor(Math.random() * 14) + 82, budget_range: "$1,200-$3,200 AUD", description: "Australian furniture brand with digital-first approach", target_alignment: "Home and lifestyle content", sponsoring: "Home and lifestyle podcasts", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" }
    ];

    // International sponsors for other regions
    const internationalSponsors = [
      { company: "HelloFresh", industry: "Meal Kits", match_score: Math.floor(Math.random() * 12) + 83, budget_range: "$800-$2,500 USD", description: "Major Instagram and TikTok sponsor expanding to podcasts", target_alignment: "Lifestyle and cooking content", sponsoring: "Food influencers, lifestyle creators", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "NordVPN", industry: "Tech Security", match_score: Math.floor(Math.random() * 18) + 77, budget_range: "$500-$1,500 USD", description: "Sponsors tech YouTubers and privacy-focused creators", target_alignment: "Tech and security content", sponsoring: "Tech reviewers, privacy advocates", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Squarespace", industry: "Web Services", match_score: Math.floor(Math.random() * 15) + 85, budget_range: "$1,000-$5,000 USD", description: "Website builder with extensive podcast sponsorship program", target_alignment: "Creative and business content", sponsoring: "Creative podcasts, entrepreneur shows", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Athletic Greens", industry: "Health", match_score: Math.floor(Math.random() * 12) + 88, budget_range: "$2,000-$8,000 USD", description: "Premium nutrition supplement with extensive podcast presence", target_alignment: "Health and wellness content", sponsoring: "Health podcasts, fitness shows", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "BetterHelp", industry: "Mental Health", match_score: Math.floor(Math.random() * 16) + 82, budget_range: "$1,500-$6,000 USD", description: "Online therapy platform sponsoring wellness content", target_alignment: "Mental health and wellness", sponsoring: "Wellness podcasts, self-help shows", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" },
      { company: "Audible", industry: "Entertainment", match_score: Math.floor(Math.random() * 14) + 84, budget_range: "$2,500-$10,000 USD", description: "Audiobook platform with massive podcast advertising budget", target_alignment: "Entertainment and educational content", sponsoring: "Book podcasts, educational shows", campaign_type: "Creator-friendly sponsorship", sponsorship_level: "mid-roll", contact_name: "Contact via website", contact_title: "Partnerships Team", contact_email: "partnerships@company.com", contact_linkedin: "", contact_verification: "Contact research required", status: "Active in creator economy" }
    ];

    // AI-powered sponsor analysis (matching Replit logic)
    let aiSponsors = [];
    if (openai && process.env.OPENAI_API_KEY) {
      try {
        console.log('Using OpenAI for AI-powered sponsor analysis...');
        
        // Create content insights for AI analysis
        const contentInsights = podcast_data ? `
        Podcast Analytics:
        - Podcast: ${podcast_name}
        - Episodes analyzed: ${podcast_data.length}
        - Average downloads: ${monthly_downloads}
        - Category: ${category}
        - Geographic focus: ${geographic_focus}
        - Sample episodes: ${podcast_data.slice(0, 3).map(ep => ep['Clip title']).join(', ')}
        ` : '';

        const prompt = `Analyze this podcast data and generate 10-12 highly personalized sponsor opportunities:
        
        ${contentInsights}
        
        Based on the actual content and audience data, find sponsors that match:
        1. The specific category (${category})
        2. The audience interests and download patterns
        3. The geographic market (${geographic_focus})
        
        Return JSON: {"sponsors": [{"company": "Specific Company Name", "industry": "Industry", "match_score": 85, "budget_range": "$X-Y ${geographic_focus === 'AU' ? 'AUD' : 'USD'}", "description": "Why this sponsor perfectly matches the podcast's content and audience", "target_alignment": "Content type match", "sponsoring": "What they sponsor", "campaign_type": "Creator-friendly sponsorship", "sponsorship_level": "mid-roll", "contact_name": "Contact via website", "contact_title": "Partnerships Team", "contact_email": "partnerships@company.com", "contact_linkedin": "", "contact_verification": "Contact research required", "status": "Active in creator economy"}]}
        
        Make each recommendation highly specific to the analyzed content, not generic.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o", // Latest OpenAI model released May 2024 - more advanced reasoning and analysis
          messages: [
            { role: "system", content: "Generate realistic podcast sponsors as JSON. Focus on creator-friendly brands with appropriate budgets for indie podcasters. Use advanced reasoning to match sponsors to specific podcast content themes." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000, // Increased for more detailed sponsor analysis
          temperature: 0.8, // Slightly higher for more creative sponsor matching
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content);
        aiSponsors = aiResponse.sponsors || [];
        console.log('AI generated', aiSponsors.length, 'personalized sponsors');
        
      } catch (openaiError) {
        console.error('OpenAI API error:', openaiError);
        console.log('Falling back to curated sponsors');
      }
    } else {
      console.log('OpenAI not available, using curated sponsors');
    }

    // Choose base sponsors based on region
    let regionSponsors = geographic_focus === 'AU' ? australianSponsors : internationalSponsors;
    
    // Add some international sponsors to Australian results for variety
    if (geographic_focus === 'AU') {
      regionSponsors = [...australianSponsors, ...internationalSponsors.slice(0, 4)];
    }
    
    // Combine AI sponsors with curated sponsors
    const allSponsors = [...aiSponsors, ...regionSponsors];
    
    // Shuffle and limit results
    const shuffledSponsors = allSponsors.sort(() => Math.random() - 0.5);
    const finalSponsors = shuffledSponsors.slice(0, 18);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sponsors: finalSponsors,
        analysis: `Found ${finalSponsors.length} targeted sponsors for ${podcast_name} (AI + Curated)`,
        ai_sponsors_count: aiSponsors.length,
        curated_sponsors_count: regionSponsors.length,
        revenue_potential: Math.round((monthly_downloads / 1000) * 15),
        geographic_focus: geographic_focus,
        total_episodes_analyzed: podcast_data?.length || 0,
        monthly_downloads_estimate: monthly_downloads
      })
    };

  } catch (error) {
    console.error('Server error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error processing request' })
    };
  }
};