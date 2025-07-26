import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Extract the proper Supabase URL if we got the DATABASE_URL instead
let supabaseUrl = rawSupabaseUrl;
if (rawSupabaseUrl && rawSupabaseUrl.includes('postgresql://')) {
  // Extract project ID from DATABASE_URL format: postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
  const match = rawSupabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
  if (match) {
    const projectId = match[1];
    supabaseUrl = `https://${projectId}.supabase.co`;
    console.log('Extracted Supabase URL from DATABASE_URL:', supabaseUrl);
  }
}

console.log('Supabase config check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl,
  wasExtracted: rawSupabaseUrl !== supabaseUrl
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
}

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export { supabase };