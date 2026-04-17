# 🍪 Cookie Care Joy

A beautiful, self-contained PWA for sweet reminders and to-do list management. No backend required!

## ✨ Features

✅ **Web Push Notifications** - Native push API (no OneSignal)  
✅ **25+ Sweet Messages** - Rotating affirmations and reminders  
✅ **To-Do List Tracking** - Save tasks locally  
✅ **Customizable Reminders** - Set interval, wake up & bedtime  
✅ **Offline Capable** - Works without internet  
✅ **PWA Ready** - Install on home screen  
✅ **Dark Mode Support** - Automatically respects system preference  
✅ **Zero Dependencies** - Pure HTML/CSS/JavaScript  

## 📁 Project Structure

```
Cookie-Care-Joy/
├── public/
│   ├── index.html          # Main app (all-in-one)
│   ├── sw.js               # Service Worker
│   ├── manifest.json       # PWA manifest
│   └── .gitignore
├── docs/
│   ├── REFACTOR_GUIDE.md   # Step-by-step deployment
│   ├── BUGS.md             # Fixed issues
│   └── MIGRATION.md        # OneSignal removal notes
├── README.md
└── .gitignore
```

## 🚀 Quick Start

### Local Development

1. **Clone the repo:**
   ```bash
   git clone https://github.com/AlexandraDigital/Cookie-Care-Joy.git
   cd Cookie-Care-Joy
   ```

2. **Start a local server:**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Or Node.js
   npx http-server public -p 8000
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

### Deploy to Cloudflare Pages

1. **Push to GitHub** (you're on the right branch!)

2. **Connect to Cloudflare Pages:**
   - Go to https://pages.cloudflare.com
   - Connect your GitHub account
   - Select `AlexandraDigital/Cookie-Care-Joy`
   - Set build command: `echo "No build needed"`
   - Set publish directory: `public`

3. **Deploy!** 🚀

Cloudflare will auto-deploy on every push to `main`.

## 💬 How It Works

### 1. **Pink Banner Settings**
Users enable notifications and customize:
- Notification interval (1-4 hours)
- Wake up time (when reminders start)
- Bedtime (when reminders stop)

### 2. **Sweet Messages**
Every notification picks a random message from 25+ options:
- Self-care affirmations
- To-do list reminders
- Motivation & encouragement

### 3. **Local Storage**
Everything saves in browser localStorage:
- Settings
- To-do tasks
- Notification history

### 4. **Service Worker**
Handles:
- Push notifications (shows even with app closed)
- Offline caching
- Auto-opens app when notification clicked

## 🔔 Push Notifications

### How to Test Locally

1. **Enable notifications** in the pink banner
2. **Allow permission** when prompted
3. **Wait for scheduled notification** OR manually test:

```javascript
// In browser console:
navigator.serviceWorker.ready.then(reg => {
    reg.showNotification('Test', {
        body: '🍪 This is a test notification!'
    })
})
```

### Production (Cloudflare Pages)

Push notifications work automatically - no extra setup needed!
Users enable it in the app, grant permission, and notifications appear at scheduled times.

## 📦 What Changed

### Removed ❌
- OneSignal (external dependency)
- Cloudflare Worker for OneSignal proxy
- API keys in code
- Babel transpiler (900KB bloat)
- External JavaScript libraries

### Added ✅
- Native Web Push API
- Service Worker push handling
- 25+ sweet message library
- localStorage management
- Customizable notification settings
- Full offline support
- PWA installation support

## 🐛 Bug Fixes

- ✅ **Duplicate pink banner** - Fixed CSS classNames (was using commas instead of spaces)
- ✅ **Babel bloat** - Removed, code is native JS
- ✅ **API key exposure** - No keys in code anymore
- ✅ **CORS issues** - No proxy needed with Web Push

## 🧪 Testing Checklist

- [ ] Open app in browser
- [ ] Enable notifications in pink banner
- [ ] Grant permission when prompted
- [ ] Set notification interval to 1 hour (for testing)
- [ ] Close the app and wait for notification
- [ ] Click notification to open app
- [ ] Add tasks to to-do list
- [ ] Refresh page - tasks still there
- [ ] Toggle dark mode - app adapts
- [ ] Open on mobile - responsive design works

## 📱 Mobile Installation

1. Open app in browser
2. Tap menu (⋯) → "Install app" (or "Add to Home Screen")
3. Grant permissions
4. Notifications will work like native app!

## 🔐 Privacy & Security

- ✅ No external services (except Cloudflare CDN)
- ✅ All data stays in user's browser
- ✅ No tracking or analytics
- ✅ No API keys exposed
- ✅ Works offline

## 🛠️ Development

### Edit Messages
Edit `SWEET_MESSAGES` array in `index.html`:
```javascript
const SWEET_MESSAGES = [
    {
        title: "Your Title",
        body: "Your message"
    },
    // ... more messages
];
```

### Add New Features
All code is in one file for simplicity. To modularize:
1. Extract code sections into separate files
2. Import in index.html
3. Update build process if needed

### Deploy Changes
```bash
git add .
git commit -m "your message"
git push origin main
```

Cloudflare Pages auto-deploys!

## 📚 Documentation

- **[REFACTOR_GUIDE.md](docs/REFACTOR_GUIDE.md)** - Complete migration from OneSignal
- **[BUGS.md](docs/BUGS.md)** - All fixed bugs documented
- **[MIGRATION.md](docs/MIGRATION.md)** - Why we ditched OneSignal

## 🤝 Support

Found a bug? Have a feature request?
[Create an issue](https://github.com/AlexandraDigital/Cookie-Care-Joy/issues)

## 📄 License

MIT License - feel free to use and modify!

---

**Made with 💕 for self-care and productivity**

🍪 Remember to take care of yourself!
