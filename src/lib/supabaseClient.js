import { createClient } from '@supabase/supabase-js';

// Allow configuration via Vite env or a global injected by WordPress (wp_localize_script).
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof window !== 'undefined' && window.BICICOLOMBIA_SUPABASE_URL) ||
  'https://uzltcajewxbcfkdnftim.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined' && window.BICICOLOMBIA_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bHRjYWpld3hiY2ZrZG5mdGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NzY1NzEsImV4cCI6MjA2NzA1MjU3MX0.w3fmgxKOAiqVYiH6YOlmX04hYModIW8IRgHtv-q5nl8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
