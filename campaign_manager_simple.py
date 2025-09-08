import os
import sqlite3
from datetime import datetime
from flask import Flask, jsonify, render_template_string, request, redirect, url_for
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "campaign-secret-key"

def init_db():
    """Initialize the database"""
    conn = sqlite3.connect('campaigns.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            podcast_name TEXT NOT NULL,
            rss_feed TEXT NOT NULL,
            target_audience TEXT,
            budget INTEGER,
            status TEXT DEFAULT 'active',
            clicks INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

@app.route('/')
def campaign_home():
    """Campaign home page"""
    # Get campaign stats from database
    conn = sqlite3.connect('campaigns.db')
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM campaigns WHERE status = "active"')
    active_campaigns = cursor.fetchone()[0]
    cursor.execute('SELECT SUM(clicks) FROM campaigns')
    total_clicks = cursor.fetchone()[0] or 0
    cursor.execute('SELECT * FROM campaigns ORDER BY created_at DESC')
    campaigns = cursor.fetchall()
    conn.close()
    
    campaigns_html = ""
    for campaign in campaigns:
        status_color = "bg-green-600" if campaign[5] == 'active' else "bg-yellow-600" if campaign[5] == 'pending' else "bg-red-600"
        campaigns_html += f"""
            <div class="bg-gray-800 p-4 rounded-lg mb-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold">{campaign[1]}</h3>
                        <p class="text-gray-400">{campaign[2]}</p>
                        <p class="text-sm text-gray-500">Target: {campaign[4] or 'General audience'}</p>
                    </div>
                    <div class="text-right">
                        <span class="{status_color} px-2 py-1 rounded text-sm">{campaign[5].title()}</span>
                        <p class="text-gray-400 mt-1">{campaign[6]} clicks</p>
                    </div>
                </div>
            </div>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Campaign Manager</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            .btn-primary {{
                background: linear-gradient(135deg, #1e90ff, #36b4ff);
                color: white;
                font-weight: 600;
                transition: all 0.3s ease;
            }}
            .btn-primary:hover {{
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(30, 144, 255, 0.4);
            }}
        </style>
    </head>
    <body class="bg-gray-900 text-white">
        <div class="container mx-auto px-4 py-8">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-[#1e90ff]">Campaign Manager</h1>
                    <p class="text-gray-300">Manage your podcast campaigns and track performance.</p>
                </div>
                <button onclick="showCreateForm()" class="btn-primary px-6 py-3 rounded-lg">+ Create Campaign</button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-blue-600 p-6 rounded-lg">
                    <h3 class="font-semibold text-lg">Active Campaigns</h3>
                    <p class="text-3xl font-bold">{active_campaigns}</p>
                </div>
                <div class="bg-green-600 p-6 rounded-lg">
                    <h3 class="font-semibold text-lg">Total Clicks</h3>
                    <p class="text-3xl font-bold">{total_clicks}</p>
                </div>
                <div class="bg-purple-600 p-6 rounded-lg">
                    <h3 class="font-semibold text-lg">Avg. CTR</h3>
                    <p class="text-3xl font-bold">{(total_clicks / max(active_campaigns, 1) * 0.1):.1f}%</p>
                </div>
            </div>

            <!-- Create Campaign Form (Hidden by default) -->
            <div id="createForm" class="bg-gray-800 p-6 rounded-lg mb-8 hidden">
                <h2 class="text-xl font-semibold mb-4">Create New Campaign</h2>
                <form action="/create_campaign" method="POST" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Campaign Name</label>
                        <input type="text" name="name" required class="w-full p-3 bg-gray-700 rounded-lg text-white" placeholder="e.g., Summer Promotion">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Podcast Name</label>
                        <input type="text" name="podcast_name" required class="w-full p-3 bg-gray-700 rounded-lg text-white" placeholder="Your podcast name">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">RSS Feed URL</label>
                        <input type="url" name="rss_feed" required class="w-full p-3 bg-gray-700 rounded-lg text-white" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Target Audience</label>
                        <input type="text" name="target_audience" class="w-full p-3 bg-gray-700 rounded-lg text-white" placeholder="e.g., Tech professionals, 25-45">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Budget (USD)</label>
                        <input type="number" name="budget" class="w-full p-3 bg-gray-700 rounded-lg text-white" placeholder="1000">
                    </div>
                    <div class="flex space-x-4">
                        <button type="submit" class="btn-primary px-6 py-3 rounded-lg">Create Campaign</button>
                        <button type="button" onclick="hideCreateForm()" class="bg-gray-600 px-6 py-3 rounded-lg hover:bg-gray-500">Cancel</button>
                    </div>
                </form>
            </div>

            <!-- Campaigns List -->
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-xl font-semibold mb-4">Your Campaigns</h2>
                {campaigns_html if campaigns_html else '<p class="text-gray-400">No campaigns yet. Create your first campaign to get started!</p>'}
            </div>
        </div>

        <script>
            function showCreateForm() {{
                document.getElementById('createForm').classList.remove('hidden');
            }}
            function hideCreateForm() {{
                document.getElementById('createForm').classList.add('hidden');
            }}
        </script>
    </body>
    </html>
    """
    return html

@app.route('/create_campaign', methods=['POST'])
def create_campaign():
    """Create a new campaign"""
    try:
        name = request.form.get('name')
        podcast_name = request.form.get('podcast_name')
        rss_feed = request.form.get('rss_feed')
        target_audience = request.form.get('target_audience')
        budget = request.form.get('budget')
        
        conn = sqlite3.connect('campaigns.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO campaigns (name, podcast_name, rss_feed, target_audience, budget)
            VALUES (?, ?, ?, ?, ?)
        ''', (name, podcast_name, rss_feed, target_audience, budget))
        conn.commit()
        conn.close()
        
        return redirect(url_for('campaign_home'))
    except Exception as e:
        return f"Error creating campaign: {str(e)}", 500

@app.route('/api/campaigns')
def api_campaigns():
    """API endpoint to get campaigns"""
    conn = sqlite3.connect('campaigns.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM campaigns ORDER BY created_at DESC')
    campaigns = cursor.fetchall()
    conn.close()
    
    campaign_list = []
    for campaign in campaigns:
        campaign_list.append({
            'id': campaign[0],
            'name': campaign[1],
            'podcast_name': campaign[2],
            'rss_feed': campaign[3],
            'target_audience': campaign[4],
            'budget': campaign[5],
            'status': campaign[6],
            'clicks': campaign[7],
            'created_at': campaign[8]
        })
    
    return jsonify({
        'success': True,
        'campaigns': campaign_list
    })

@app.route('/campaign/<int:campaign_id>')
def campaign_details(campaign_id):
    """View campaign details and analytics"""
    conn = sqlite3.connect('campaigns.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM campaigns WHERE id = ?', (campaign_id,))
    campaign = cursor.fetchone()
    conn.close()
    
    if not campaign:
        return "Campaign not found", 404
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Campaign: {campaign[1]}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-900 text-white">
        <div class="container mx-auto px-4 py-8">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-[#1e90ff]">{campaign[1]}</h1>
                    <p class="text-gray-300">Campaign Analytics Dashboard</p>
                </div>
                <a href="/" class="bg-gray-600 px-4 py-2 rounded-lg hover:bg-gray-500">← Back to Campaigns</a>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-blue-600 p-6 rounded-lg">
                    <h3 class="font-semibold">Total Clicks</h3>
                    <p class="text-2xl font-bold">{campaign[7]}</p>
                </div>
                <div class="bg-green-600 p-6 rounded-lg">
                    <h3 class="font-semibold">Status</h3>
                    <p class="text-xl font-bold">{campaign[6].title()}</p>
                </div>
                <div class="bg-purple-600 p-6 rounded-lg">
                    <h3 class="font-semibold">Budget</h3>
                    <p class="text-xl font-bold">${campaign[5] or 0}</p>
                </div>
                <div class="bg-orange-600 p-6 rounded-lg">
                    <h3 class="font-semibold">CTR</h3>
                    <p class="text-xl font-bold">{(campaign[7] * 0.1):.1f}%</p>
                </div>
            </div>
            
            <div class="bg-gray-800 p-6 rounded-lg mb-6">
                <h2 class="text-xl font-semibold mb-4">Campaign Details</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p class="text-gray-400">Podcast Name</p>
                        <p class="text-lg">{campaign[2]}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Target Audience</p>
                        <p class="text-lg">{campaign[4] or 'General audience'}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">RSS Feed</p>
                        <p class="text-sm text-blue-300 break-all">{campaign[3]}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Created</p>
                        <p class="text-lg">{campaign[8]}</p>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return html

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)