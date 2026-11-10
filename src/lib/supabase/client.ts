import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { validateSupabaseEnv } from '@/lib/env-validation';

export function createClient() {
  // Validate environment variables on first use (fail-fast)
  const { url, anonKey } = validateSupabaseEnv();

  return createBrowserClient<Database>(url, anonKey);
}