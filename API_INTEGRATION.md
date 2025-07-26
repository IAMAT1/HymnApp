# API Integration Guide

This guide explains how to connect your Spotify clone frontend to your Hugging Face Spaces backend.

## Quick Setup

1. **Update the API URL**
   - Open `client/src/config/api.ts`
   - Replace `https://your-hf-space.hf.space` with your actual Hugging Face Space URL
   - Example: `https://your-username-music-app.hf.space`

2. **Backend API Requirements**
   Your Hugging Face backend should provide these endpoints:

### Search Songs
```
GET /search?q=<query>
```
**Expected Response:**
```json
[
  {
    "id": "unique-song-id",
    "title": "Song Title",
    "artist": "Artist Name",
    "thumbnail": "https://example.com/thumbnail.jpg",
    "duration": 240
  }
]
```

### Get Stream URL
```
GET /stream?id=<song-id>
```
**Expected Response:**
```json
{
  "url": "https://example.com/stream.webm",
  "duration": 240
}
```

### Get Song Details (Optional)
```
GET /song?id=<song-id>
```
**Expected Response:**
```json
{
  "id": "unique-song-id",
  "title": "Song Title",
  "artist": "Artist Name",
  "thumbnail": "https://example.com/thumbnail.jpg",
  "duration": 240
}
```

## Features

✅ **Search Integration**: Live search with debounced API calls
✅ **Audio Streaming**: Direct audio streaming from your backend
✅ **Error Handling**: User-friendly error messages for failed requests
✅ **Loading States**: Smooth loading animations during API calls
✅ **Offline Storage**: Liked songs and recently played stored locally
✅ **Retry Logic**: Automatic retry for failed requests
✅ **Timeout Protection**: 30-second timeout for API requests

## Error Handling

The app handles these common scenarios:
- Network timeouts
- Server errors (403, 404, 500)
- Invalid responses
- Missing audio streams
- Search failures

Users see helpful toast notifications for all errors.

## Local Storage

The app uses localStorage for:
- **Liked Songs**: Full song objects with metadata
- **Recently Played**: Song IDs for backend re-fetching
- **User Preferences**: Player settings and UI state

## Configuration Options

In `client/src/config/api.ts`, you can adjust:
- `BASE_URL`: Your backend URL
- `TIMEOUT`: Request timeout (default: 30 seconds)
- `RETRY_ATTEMPTS`: Number of retry attempts (default: 3)
- `RETRY_DELAY`: Delay between retries (default: 1 second)

## Testing

To test the integration:
1. Update the BASE_URL in the config
2. Try searching for songs
3. Attempt to play a song
4. Check browser console for API call logs
5. Monitor network tab for request/response details

## Deployment

This frontend is designed for static hosting and works with:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

No server-side rendering or Node.js runtime required.