import { createClient, SupabaseClient } from '@supabase/supabase-js';

const requiredEnv = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`${name} ausente. Configure ${name} antes de iniciar o sistema.`);
  }
  return value;
};

const supabaseUrl = requiredEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
const supabaseAnonKey = requiredEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
