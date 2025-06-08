import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qfgmkcbbbiiovmmmfipa.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ21rY2JiYmlpb3ZtbW1maXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NjQzODcsImV4cCI6MjA2MzE0MDM4N30.0adnE0HaoO5JqkuXku9WT1n2DDJEVKYcmSvT49gw1_I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);