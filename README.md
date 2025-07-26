# Spotify Clone - Music Streaming App

A beautiful music streaming application built with React and TypeScript, featuring a Spotify-like interface with real audio streaming capabilities.

## ✨ Features

- 🎵 Search music using iTunes API
- 🎧 Stream audio via YouTube (backend integration)
- 📱 Responsive design that works on all devices
- 💖 Like songs and manage favorites
- 📜 Recently played tracking
- 🎨 Beautiful Spotify-inspired UI with dark theme
- ⚡ Fast and smooth user experience

## 🚀 Quick Start (Windows)

### Prerequisites
- [Node.js](https://nodejs.org/) (Download and install the LTS version)

### Setup
1. **Download the project**
   - Download as ZIP from Replit, or
   - Clone from GitHub: `git clone <your-repo-url>`

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the app**
   - **Easy way**: Double-click `start-dev.bat`
   - **Command line**: Run `npm run dev`

4. **Open in browser**
   - Go to `http://localhost:5000`

That's it! 🎉

## 📖 Detailed Setup

For detailed setup instructions, troubleshooting, and platform-specific guidance, see [LOCAL_SETUP.md](LOCAL_SETUP.md).

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Audio**: YouTube streaming via Cloudflare backend
- **UI Components**: Radix UI, shadcn/ui
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom theme

## 🎯 How It Works

1. **Search**: Uses iTunes API to find song metadata
2. **Stream**: Connects to your Cloudflare backend for audio streaming
3. **Play**: Beautiful player interface with all the controls you expect
4. **Save**: Liked songs stored in your browser

## 📁 Project Structure

```
├── client/          # React frontend
├── server/          # Express backend  
├── shared/          # Shared types
├── start-dev.bat    # Windows startup script
└── LOCAL_SETUP.md   # Detailed setup guide
```

## 🌐 Live Demo

The app works with your existing Cloudflare backend for streaming real audio content.

## 📞 Support

Having issues? Check [LOCAL_SETUP.md](LOCAL_SETUP.md) for troubleshooting tips!