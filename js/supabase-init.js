(function () {
  // Allow overriding the URL/key from HTML before this script runs by setting:
  // window.SUPABASE_CONFIG = { url: 'https://your-project.supabase.co', anonKey: 'YOUR_ANON_KEY' };
  const cfg = window.SUPABASE_CONFIG || {};
  const SUPABASE_URL = cfg.url || 'https://pzjkueabaclfimqmylat.supabase.co';
  const SUPABASE_ANON_KEY = cfg.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6amt1ZWFiYWNsZmltcW15bGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTY3ODksImV4cCI6MjA3NDk3Mjc4OX0.6FI5GblT-_xFVT3u5naz3Gyb0RI653aEhLQhzqU6-qA';

  if (window.supabaseClientInitialized) {
    console.debug('Supabase client already initialized (guard active).');
    return;
  }

  try {
    // Prefer ESM global createClient if available (some bundles expose this)
    if (typeof createClient === 'function') {
      window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (window.supabase && typeof window.supabase.createClient === 'function') {
      // Some CDN builds attach a global `supabase` object exposing createClient
      window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (window.Supabase && typeof window.Supabase.createClient === 'function') {
      window.supabase = window.Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('Supabase client library not found. If you use a bundler or CDN, ensure it is loaded before supabase-init.js.');
      return;
    }

    window.supabaseClientInitialized = true;
    // Expose the active config for debugging if needed
    window.SUPABASE_ACTIVE_CONFIG = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
    console.info('Supabase initialized:', !!window.supabase);
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
  }
})();
