import { createClient } from '@/lib/supabase/client';

export function opsClient() {
  return createClient() as any;
}
