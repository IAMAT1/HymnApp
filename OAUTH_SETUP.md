# OAuth Setup Guide for Hymn Music App

## Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select Project**
   - Create a new project or select existing one
   - Name: "Hymn Music App"

3. **Enable Google+ API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "Hymn Web Client"
   - Authorized redirect URIs:
     - `https://[YOUR-SUPABASE-PROJECT].supabase.co/auth/v1/callback`
     - `http://localhost:5000/auth/callback` (for development)

5. **Copy Client Credentials**
   - Save Client ID and Client Secret for Supabase configuration

## GitHub OAuth Setup

1. **Go to GitHub Settings**
   - Visit: https://github.com/settings/developers

2. **Create New OAuth App**
   - Click "New OAuth App"
   - Application name: "Hymn Music App"
   - Homepage URL: `https://your-domain.com` or `http://localhost:5000`
   - Authorization callback URL: `https://[YOUR-SUPABASE-PROJECT].supabase.co/auth/v1/callback`

3. **Copy Credentials**
   - Save Client ID and Client Secret for Supabase configuration

## Supabase Configuration

1. **Go to Supabase Dashboard**
   - Visit your project at: https://supabase.com/dashboard/project/[PROJECT-ID]

2. **Configure Authentication**
   - Go to "Authentication" > "Providers"
   - Enable Google:
     - Paste Google Client ID
     - Paste Google Client Secret
   - Enable GitHub:
     - Paste GitHub Client ID
     - Paste GitHub Client Secret

3. **Update Environment Variables**
   - Add to your Replit secrets:
     - `VITE_SUPABASE_URL`: Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon public key

## URL Configuration

Make sure these URLs are added to your OAuth provider settings:

**Production:**
- `https://[YOUR-SUPABASE-PROJECT].supabase.co/auth/v1/callback`

**Development:**
- `http://localhost:5000/auth/callback`
- `https://[REPLIT-DOMAIN].replit.dev/auth/callback`

## Testing

1. The app currently uses development mode with mock OAuth
2. Once you configure real OAuth credentials, remove the mock implementation
3. Test Google and GitHub sign-in from the landing page

## Security Notes

- Never commit OAuth secrets to version control
- Use environment variables for all sensitive credentials
- Configure proper redirect URIs to prevent security issues
- Test OAuth flow in both development and production environments