// Simple script to ping Supabase to prevent pausing
// Run with: node ping-supabase.js

const https = require('https');

// Configuration from your supabase-init.js
const SUPABASE_URL = 'pzjkueabaclfimqmylat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6amt1ZWFiYWNsZmltcW15bGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTY3ODksImV4cCI6MjA3NDk3Mjc4OX0.6FI5GblT-_xFVT3u5naz3Gyb0RI653aEhLQhzqU6-qA';

const options = {
  hostname: SUPABASE_URL,
  path: '/rest/v1/cars?select=id&limit=1',
  method: 'GET',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  }
};

const req = https.request(options, (res) => {
  console.log(`Ping Status: ${res.statusCode} (200 means success)`);
});

req.on('error', (error) => console.error(error));
req.end();