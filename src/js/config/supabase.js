/* ====================================================
   SUPABASE CONNECTION MODULE (Cloud Sync Configuration)
   ==================================================== */

// Paste your Supabase credentials here for global data sync:
export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // Replace with Project URL
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsIn...';      // Replace with anon public Key

// Check if valid client settings exist
export const isCloudDb = 
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co' &&
  SUPABASE_ANON_KEY !== 'eyJhbGciOiJIUzI1NiIsIn...';

// Instantiate the Supabase client dynamically if valid credentials exist
export const supabase = isCloudDb 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;
