// Sweet & Soulful Motivational Messages for Cookie-Care-Joy
// Add this to your app to display affirming messages when users open the app

const MOTIVATIONAL_MESSAGES = [
  "You deserve this moment of sweetness. Take a breath. 🍪✨",
  "You're doing better than you think. Really.",
  "Self-care isn't selfish—it's sacred. You're worth it. 💝",
  "Today, be as kind to yourself as you are to others.",
  "Your gentle efforts matter. You matter.",
  "Pause. Breathe. You're exactly where you need to be. 🌙",
  "Choosing joy is an act of courage. Look at you. 💫",
  "You're stronger than your doubts. Trust yourself.",
  "In this moment, you are enough. Just as you are.",
  "Nourish yourself like you're someone you love. 🍪💕",
  "Small steps are still progress. Be proud.",
  "You're allowed to rest. You're allowed to feel good.",
  "Your heart is brave. Keep going, sweet soul.",
  "Today's permission: be soft with yourself.",
  "You're building something beautiful—a life worth savoring.",
  "Celebrate the wins, no matter how small. You earned this. ✨",
  "Your presence is a gift. Never forget that.",
  "Take what you need. Leave what you don't. That's wisdom.",
  "You're doing the thing. That takes courage.",
  "Breathe in kindness. Breathe out doubt. 🌸"
];

// Function to get a random motivational message
function getRandomMessage() {
  return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
}

// Function to show the motivational message modal
function showMotivationalMessage() {
  // Check if user has already seen a message today
  const today = new Date().toDateString();
  const lastMessageDate = localStorage.getItem('ccj-message-date');
  
  // Show message once per day, or force show on first visit
  if (lastMessageDate !== today || !lastMessageDate) {
    const message = getRandomMessage();
    displayMessageModal(message);
    localStorage.setItem('ccj-message-date', today);
  }
}

// Function to display the message in a modal
function displayMessageModal(message) {
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'ccj-message-modal';
  modal.innerHTML = `
    <div class="ccj-message-content">
      <p class="ccj-message-text">${message}</p>
      <button class="ccj-message-close">Continue 🍪</button>
    </div>
  `;
  
  // Add styles if not already present
  if (!document.getElementById('ccj-message-styles')) {
    const styles = document.createElement('style');
    styles.id = 'ccj-message-styles';
    styles.innerHTML = `
      .ccj-message-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s ease-in;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .ccj-message-content {
        background: linear-gradient(135deg, #fff5fa 0%, #ffe4f0 100%);
        border-radius: 24px;
        padding: 40px 32px;
        max-width: 90%;
        width: 400px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(249, 168, 212, 0.3);
        animation: slideUp 0.4s ease-out;
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .ccj-message-text {
        font-size: 18px;
        line-height: 1.6;
        color: #5a4a6a;
        margin: 0 0 24px 0;
        font-weight: 500;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .ccj-message-close {
        background: linear-gradient(135deg, #f9a8d4 0%, #f08ec9 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 12px 28px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .ccj-message-close:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(249, 168, 212, 0.4);
      }
      
      .ccj-message-close:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styles);
  }
  
  // Add close functionality
  const closeBtn = modal.querySelector('.ccj-message-close');
  closeBtn.addEventListener('click', () => {
    modal.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => modal.remove(), 300);
  });
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => modal.remove(), 300);
    }
  });
  
  document.body.appendChild(modal);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showMotivationalMessage);
} else {
  showMotivationalMessage();
}
