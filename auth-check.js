// Authentication check for premium features
function checkPremiumAccess(redirectToLogin = true) {
    const hasPremium = localStorage.getItem('podboost_premium') === 'true';
    const hasActiveSubscription = localStorage.getItem('podboost_subscription_active') === 'true';
    
    if (!hasPremium || !hasActiveSubscription) {
        if (redirectToLogin) {
            showLoginModal();
            return false;
        }
        return false;
    }
    return true;
}

function showLoginModal() {
    // Create modal overlay
    const modalHTML = `
        <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-gray-800 p-8 rounded-lg max-w-md w-full mx-4 border border-[#1e90ff]/30">
                <div class="text-center mb-6">
                    <h2 class="text-2xl font-bold text-[#1e90ff] mb-2">Premium Feature</h2>
                    <p class="text-gray-300">This feature requires a PodBoost Premium subscription</p>
                </div>
                
                <div class="space-y-4">
                    <div class="text-center">
                        <p class="text-gray-300 mb-4">Get access to:</p>
                        <ul class="text-left text-gray-300 space-y-2 mb-6">
                            <li>✓ AI-Powered Sponsorship Finder</li>
                            <li>✓ Social Media Tracker</li>
                            <li>✓ Campaign Manager</li>
                            <li>✓ Advanced Analytics</li>
                            <li>✓ Growth Engine Insights</li>
                        </ul>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button onclick="redirectToPremium()" class="flex-1 bg-[#1e90ff] hover:bg-[#36b4ff] text-white py-3 px-4 rounded-lg font-semibold transition-colors">
                            Subscribe ($7/mo)
                        </button>
                        <button onclick="closeLoginModal()" class="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 px-4 rounded-lg font-semibold transition-colors">
                            Cancel
                        </button>
                    </div>
                    
                    <div class="text-center">
                        <button onclick="redirectToLogin()" class="text-[#1e90ff] hover:text-[#36b4ff] text-sm underline">
                            Already have an account? Sign in
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.remove();
    }
}

function redirectToPremium() {
    window.location.href = '/premium';
}

function redirectToLogin() {
    window.location.href = '/login';
}

// Check authentication on page load for premium pages
function initPremiumPage() {
    // List of premium-only pages
    const premiumPages = [
        'sponsorship-finder.html',
        'social-media-tracker.html',
        'campaigns.html',
        'growth-engine.html'
    ];
    
    const currentPage = window.location.pathname.split('/').pop();
    
    if (premiumPages.includes(currentPage)) {
        if (!checkPremiumAccess(false)) {
            // Show premium required message
            document.body.innerHTML = `
                <div class="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div class="max-w-md w-full bg-gray-800/50 border border-[#1e90ff]/30 rounded-lg p-8 text-center">
                        <div class="text-4xl mb-4">🔒</div>
                        <h1 class="text-3xl font-bold mb-4 text-[#1e90ff]">Premium Required</h1>
                        <p class="text-gray-300 mb-6">This feature requires a PodBoost Premium subscription</p>
                        <div class="space-y-3">
                            <button onclick="window.location.href='/premium'" class="w-full bg-[#1e90ff] hover:bg-[#36b4ff] text-white py-3 rounded-lg font-semibold transition-colors">
                                Subscribe Now ($7/mo)
                            </button>
                            <button onclick="window.location.href='/login'" class="w-full bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-lg font-semibold transition-colors">
                                Sign In
                            </button>
                            <button onclick="window.location.href='/'" class="w-full text-[#1e90ff] hover:text-[#36b4ff] py-2 underline">
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return false;
        }
    }
    return true;
}

// Initialize authentication check when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    initPremiumPage();
});