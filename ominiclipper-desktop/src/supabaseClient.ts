/**
 * Supabase Client - Cloud Backend Integration
 *
 * Configuration is read from environment variables (Vite):
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Get config from environment variables (Vite exposes VITE_ prefixed vars)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
};

// Singleton client instance
let client: SupabaseClient | null = null;

/**
 * Get or create the Supabase client
 */
export const getClient = (): SupabaseClient | null => {
  if (client) return client;

  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
    return null;
  }

  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    console.log('[Supabase] Client initialized');
    return client;
  } catch (e) {
    console.error('[Supabase] Failed to initialize client:', e);
    return null;
  }
};

/**
 * Reset the client (useful for testing or re-initialization)
 */
export const resetClient = (): void => {
  client = null;
};

/**
 * Get the current authenticated user
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (e) {
    console.error('[Supabase] Failed to get user:', e);
    return null;
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> => {
  const supabase = getClient();
  if (!supabase) {
    return { user: null, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    return { user: data.user, error: null };
  } catch (e: any) {
    return { user: null, error: e.message || 'Sign in failed' };
  }
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null; needsConfirmation: boolean }> => {
  const supabase = getClient();
  if (!supabase) {
    return { user: null, error: 'Supabase not configured', needsConfirmation: false };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { user: null, error: error.message, needsConfirmation: false };
    }

    // Check if email confirmation is required
    const needsConfirmation = !data.user?.confirmed_at;

    return { user: data.user, error: null, needsConfirmation };
  } catch (e: any) {
    return { user: null, error: e.message || 'Sign up failed', needsConfirmation: false };
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<{ error: string | null }> => {
  const supabase = getClient();
  if (!supabase) {
    return { error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (e: any) {
    return { error: e.message || 'Sign out failed' };
  }
};

/**
 * Listen for auth state changes
 */
export const onAuthStateChange = (
  callback: (event: string, user: User | null) => void
): (() => void) => {
  const supabase = getClient();
  if (!supabase) {
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user || null);
  });

  return () => {
    subscription.unsubscribe();
  };
};

// ============================================
// User Profile Operations (profiles table)
// ============================================

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  stripe_customer_id: string | null;
  subscription_tier: 'free' | 'pro' | 'team';
  usage_tokens_this_month: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current user's profile
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
  const supabase = getClient();
  if (!supabase) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[Supabase] Failed to get profile:', error);
      return null;
    }

    return data as UserProfile;
  } catch (e) {
    console.error('[Supabase] Profile fetch error:', e);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  updates: Partial<Pick<UserProfile, 'full_name' | 'avatar_url'>>
): Promise<{ success: boolean; error: string | null }> => {
  const supabase = getClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message || 'Update failed' };
  }
};

/**
 * Increment token usage for the current month
 */
export const incrementTokenUsage = async (
  tokens: number
): Promise<{ success: boolean; newTotal: number; error: string | null }> => {
  const supabase = getClient();
  if (!supabase) {
    return { success: false, newTotal: 0, error: 'Supabase not configured' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, newTotal: 0, error: 'Not authenticated' };
  }

  try {
    // Use RPC for atomic increment
    const { data, error } = await supabase.rpc('increment_token_usage', {
      user_id: user.id,
      token_count: tokens,
    });

    if (error) {
      // Fallback: direct update if RPC doesn't exist
      const profile = await getUserProfile();
      if (!profile) {
        return { success: false, newTotal: 0, error: 'Profile not found' };
      }

      const newTotal = profile.usage_tokens_this_month + tokens;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ usage_tokens_this_month: newTotal })
        .eq('id', user.id);

      if (updateError) {
        return { success: false, newTotal: 0, error: updateError.message };
      }

      return { success: true, newTotal, error: null };
    }

    return { success: true, newTotal: data || 0, error: null };
  } catch (e: any) {
    return { success: false, newTotal: 0, error: e.message || 'Increment failed' };
  }
};

/**
 * Check if user has quota remaining
 */
export const checkQuota = async (
  estimatedTokens: number
): Promise<{ allowed: boolean; remaining: number; limit: number }> => {
  const profile = await getUserProfile();

  if (!profile) {
    // Not logged in - use local free tier
    return { allowed: true, remaining: 10000, limit: 10000 };
  }

  const limit = profile.is_pro ? 1_000_000 : 10_000; // Pro: 1M, Free: 10K
  const used = profile.usage_tokens_this_month;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: remaining >= estimatedTokens,
    remaining,
    limit,
  };
};

// Legacy exports for backward compatibility
export const getSupabaseConfig = () => ({
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
});

export const saveSupabaseConfig = (_url: string, _key: string) => {
  console.warn('[Supabase] saveSupabaseConfig is deprecated. Use environment variables instead.');
};
