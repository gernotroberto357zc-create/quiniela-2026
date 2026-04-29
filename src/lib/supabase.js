import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// AÑADE ESTO:
console.log("Mi URL es:", supabaseUrl);
console.log("Mi KEY es:", supabaseAnonKey); // <- Verifica qué sale aquí

export const supabase = createClient(supabaseUrl, supabaseAnonKey)