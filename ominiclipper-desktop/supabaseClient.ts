import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to get config from storage (for this demo app structure)
export const getSupabaseConfig = () => {
    return {
        url: localStorage.getItem('supabase_url') || '',
        key: localStorage.getItem('supabase_key') || ''
    }
}

export const saveSupabaseConfig = (url: string, key: string) => {
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
}

// Singleton client instance
let client: SupabaseClient | null = null;

export const getClient = (): SupabaseClient | null => {
    if (client) return client;

    const { url, key } = getSupabaseConfig();
    if (url && key) {
        try {
            client = createClient(url, key);
            return client;
        } catch (e) {
            console.error("Failed to initialize Supabase client", e);
            return null;
        }
    }
    return null;
};

export const resetClient = () => {
    client = null;
}