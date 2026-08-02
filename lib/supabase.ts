import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const isWeb = Platform.OS === 'web';

// ⚠️ Reemplazar con tus valores: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://qlswdqqjtqepxfqagooi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Hu97XQLavdKWoY2YgRDhfg_t3rRv2bf';

const storage = Platform.OS === 'web'
  ? typeof window !== 'undefined' ? window.localStorage : undefined
  : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

// Bump manually (e.g. 'v2') only after a bulk re-upload of images to the
// 'photocards' bucket, then commit — this is the only thing that busts the
// on-device expo-image cache, since bucket objects don't carry an updated_at.
const IMAGE_CACHE_VERSION = 'v1';

export function getPhotocardUrl(imagePath: string): string {
  const { data } = supabase.storage.from('photocards').getPublicUrl(imagePath);
  return `${data.publicUrl}?v=${IMAGE_CACHE_VERSION}`;
}
