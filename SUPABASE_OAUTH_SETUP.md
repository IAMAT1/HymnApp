# Supabase OAuth Setup Guide

## Current Status
✅ Supabase client configured correctly (`https://wqxewuiobaqaeyqgofdc.supabase.co`)
✅ OAuth redirect flow working properly 
✅ OAuth account creation working (user created successfully)
❌ **CRITICAL**: Site URL in Supabase is set to localhost:3000 instead of your app URL
❌ **Email confirmations redirecting to localhost:3000 instead of your app**
❌ **OAuth providers not enabled in Supabase dashboard**

## Required Steps to Enable OAuth

### 1. Fix Site URL Configuration First
- Go to: https://supabase.com/dashboard/project/wqxewuiobaqaeyqgofdc
- Navigate to **Settings** → **General**
- Find "Site URL" and change it from `http://localhost:3000` to: `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev`
- Save changes

### 2. Configure Email Redirect URLs
- Navigate to **Authentication** → **URL Configuration**
- Set "Site URL" to: `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev`
- Add to "Redirect URLs": `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev/auth/callback`

### 2.5. Disable Email Confirmation (Optional - for immediate access)
- Navigate to **Authentication** → **Settings**
- Scroll down to "User Signups"
- **Disable** "Enable email confirmations" 
- This allows OAuth users to access the app immediately without email verification

### 3. Access OAuth Providers
- Navigate to **Authentication** → **Providers**

### 4. Enable Google OAuth

**In Supabase Dashboard:**
1. Find "Google" in the providers list
2. Toggle it **ON**
3. You'll need Google OAuth credentials:

**Get Google Credentials:**
1. Go to: https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable Google+ API (APIs & Services → Library)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: **Web application**
6. **CRITICAL**: Add authorized redirect URI: `https://wqxewuiobaqaeyqgofdc.supabase.co/auth/v1/callback`
   (This MUST be the Supabase auth endpoint, NOT your app URL)
7. Copy the **Client ID** and **Client Secret**

**Back in Supabase:**
- Paste the Google Client ID
- Paste the Google Client Secret
- Save

### 5. Enable GitHub OAuth

**In Supabase Dashboard:**
1. Find "GitHub" in the providers list
2. Toggle it **ON**
3. You'll need GitHub OAuth credentials:

**Get GitHub Credentials:**
1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: "Hymn Music App"
   - Homepage URL: `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev`
   - **CRITICAL**: Authorization callback URL: `https://wqxewuiobaqaeyqgofdc.supabase.co/auth/v1/callback`
     (This MUST be the Supabase auth endpoint, NOT your app URL)
4. Copy the **Client ID** and **Client Secret**

**Back in Supabase:**
- Paste the GitHub Client ID
- Paste the GitHub Client Secret
- Save

### 6. Test OAuth
Once both providers are enabled and configured:
1. Return to your app
2. Try signing in with Google or GitHub
3. You should be redirected to the respective OAuth provider
4. After authorization, you'll be redirected back to your app

## Current Working URLs
- **Supabase Project**: `https://wqxewuiobaqaeyqgofdc.supabase.co`
- **App URL**: `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev`
- **Auth Callback**: `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev/auth/callback`

## URGENT FIX NEEDED: Site URL Configuration

**The main issue causing localhost:3000 redirects:**
1. **Supabase Site URL** is set to `http://localhost:3000` (default)
2. **This MUST be changed** to: `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev`
3. **Email confirmations** will redirect to the Site URL, which is why you're seeing localhost:3000

**OAuth Flow (after Site URL is fixed):**
1. OAuth apps (Google, GitHub) redirect to: `https://wqxewuiobaqaeyqgofdc.supabase.co/auth/v1/callback`
2. Supabase then redirects to your app: `https://8e07d3de-8a57-4ad0-81fc-1791e4ae7463-00-2efwlezt11cwc.pike.replit.dev/auth/callback`

**Both Google and GitHub OAuth apps MUST use:**
- Redirect URI: `https://wqxewuiobaqaeyqgofdc.supabase.co/auth/v1/callback`

## Troubleshooting
- ✅ Current app redirect URL is correct in the logs
- ❌ OAuth providers need to be enabled with correct Supabase callback URL
- Make sure redirect URIs match exactly (including https://)
- Check that both OAuth apps are published/approved
- Verify environment variables are set correctly