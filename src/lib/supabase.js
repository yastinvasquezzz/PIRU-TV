import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://quuckydzohzpcbzqrjew.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_r9YV9bKoRzQduj5_fvnSlA_-Wb-btno';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
