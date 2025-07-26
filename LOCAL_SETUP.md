# Local Development Setup Guide

## Prerequisites

### 1. Install Node.js
1. Go to [Node.js official website](https://nodejs.org/)
2. Download the **LTS version** (recommended for most users)
3. Run the installer and follow the setup wizard
4. Verify installation by opening Command Prompt or PowerShell and running:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers for both commands.

### 2. Install Git (Optional but recommended)
1. Go to [Git for Windows](https://git-scm.com/download/win)
2. Download and install Git
3. Use default settings during installation

### 3. No Additional Dependencies Required
The app now uses reliable web-based YouTube search APIs and no longer requires yt-dlp installation. All YouTube searches are handled through:
- Manual video ID mappings for popular songs
- Piped API for dynamic searches  
- InnerTube API as backup

This provides better reliability and eliminates YouTube bot protection issues.

## Getting the Project Files

### Option 1: Download as ZIP (Easiest)
1. In Replit, click the three dots menu (⋯) in the file explorer
2. Select "Download as ZIP"
3. Extract the ZIP file to your desired folder (e.g., `C:\Users\YourName\Desktop\music-app`)

### Option 2: Using Git (Recommended)
1. In Replit, go to the "Version Control" tab (Git icon in left sidebar)
2. Click "Create a Git repo" if not already done
3. Push your code to GitHub:
   - Click "Connect to GitHub"
   - Create a new repository
   - Push your code
4. On your PC, open Command Prompt or PowerShell
5. Navigate to where you want the project:
   ```bash
   cd C:\Users\YourName\Desktop
   ```
6. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```

## Project Setup

### 1. Install Dependencies
Open Command Prompt or PowerShell in your project folder and run:
```bash
npm install
```

This will download all required packages (React, TypeScript, Vite, etc.)

### 2. Environment Setup
The project should work out of the box with no additional environment variables needed. The backend URL is already configured to use your Cloudflare tunnel.

## Running the Application

### 1. Start the Development Server

#### Option A: Using the batch file (Windows - Easiest)
Double-click the `start-dev.bat` file in your project folder.

#### Option B: Using Command Prompt/PowerShell
In your project folder, run:
```bash
npm run dev
```

**Note for Windows users**: If you get an error about `NODE_ENV` or socket binding, use:
```bash
npx cross-env NODE_ENV=development tsx server/index.ts
```

If you get a "listen ENOTSUP" error, the server will automatically use `localhost` instead of `0.0.0.0` on Windows.

You should see output like:
```
> rest-express@1.0.0 dev
> NODE_ENV=development tsx server/index.ts

[express] serving on port 5000
```

### 2. Access the Application
Open your web browser and go to:
```
http://localhost:5000
```

The app will load and you can use it just like on Replit!

## Project Structure
```
music-app/
├── client/          # Frontend React app
│   ├── src/
│   ├── index.html
├── server/          # Backend Express server
├── shared/          # Shared types/schemas
├── package.json     # Dependencies and scripts
└── vite.config.ts   # Build configuration
```

## Available Scripts
- `npm run dev` - Start development server (frontend + backend)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Troubleshooting

### Port Already in Use
If port 5000 is busy, close other applications using that port or restart your computer.

### Socket Binding Error (Windows)
If you get "listen ENOTSUP: operation not supported on socket 0.0.0.0:5000":
- This is fixed automatically in the latest version
- The app will use `localhost` instead of `0.0.0.0` on Windows

### Dependencies Issues
If you get dependency errors, try:
```bash
npm install --force
```

### Windows-Specific Issues
- Use PowerShell or Command Prompt (not Git Bash for npm commands)
- If you get execution policy errors, run PowerShell as Administrator and execute:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- If you get `NODE_ENV` errors, install cross-env:
  ```bash
  npm install --save-dev cross-env
  ```

### Performance Tips
- Close other applications to free up memory
- Use Chrome or Edge for best performance
- If the app feels slow, try clearing browser cache

## Features That Work Locally
✅ Music search (iTunes API)
✅ Audio streaming (your Cloudflare backend)
✅ Playlist management
✅ Liked songs (saved in browser)
✅ All UI components and navigation

## Notes
- The app uses your existing Cloudflare backend for audio streaming
- All data is stored locally in your browser
- No database setup required
- Internet connection needed for music search and streaming