import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type TombShape = 'arch' | 'rect' | 'pillar' | 'rounded';

export interface Tombstone {
  id: string;
  user_id: string;
  name: string;
  birth_date: string;
  death_date: string;
  epitaph: string;
  images: string[];
  shape: TombShape;
  share_code: string;
  created_at: string;
}

export interface Message {
  id: string;
  tomb_id: string;
  text: string;
  created_at: string;
}
