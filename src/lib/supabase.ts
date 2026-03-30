import { createClient } from '@supabase/supabase-js';

export type { TombShapeConfig } from './tombstoneShape';
export { DEFAULT_SHAPE_CONFIG, getEffectiveConfig, formatDateRange } from './tombstoneShape';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Legacy shape enum — kept so existing DB rows stay type-safe
export type TombShape = 'arch' | 'rect' | 'pillar' | 'rounded';

export interface Tombstone {
  id: string;
  user_id: string;
  name: string;
  birth_date: string | null;
  death_date: string | null;
  epitaph: string;
  images: string[];
  shape: TombShape;
  shape_config: import('./tombstoneShape').TombShapeConfig | null;
  share_code: string;
  created_at: string;
}

export interface Message {
  id: string;
  tomb_id: string;
  text: string;
  created_at: string;
}
