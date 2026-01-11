import { SavedItem, SupabaseConfig, UserSession } from '../types';

/**
 * Supabase Service - Complete Data Synchronization
 *
 * Provides full CRUD operations and synchronization capabilities
 * for Supabase backend.
 */

// Rate limiting for sync operations
const SYNC_RATE_LIMIT = 100; // ms between requests
let lastSyncTime = 0;

interface SupabaseResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
}

interface UserResponse {
  id: string;
  email: string;
  created_at: string;
}

interface SessionResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user?: UserResponse;
}

interface AuthResponse {
  user?: UserResponse;
  session?: SessionResponse;
  error?: {
    message: string;
  };
}

/**
 * Check if URL is a valid Supabase instance
 */
function isValidSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('supabase.co') || parsed.hostname.includes('supabase.com');
  } catch {
    return false;
  }
}

/**
 * Validate Supabase configuration
 */
export async function validateConfig(config: SupabaseConfig): Promise<{ valid: boolean; error?: string }> {
  if (!config.url || !config.anonKey) {
    return { valid: false, error: 'URL and Anon Key are required' };
  }

  if (!isValidSupabaseUrl(config.url)) {
    return { valid: false, error: 'Invalid Supabase URL' };
  }

  try {
    // Test connection by making a simple request
    const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/${config.tableName}?limit=1`, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, error: error.message || `Connection failed: ${response.status}` };
    }

    return { valid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: errorMessage };
  }
}

/**
 * Rate-limited fetch wrapper
 */
async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastSync = now - lastSyncTime;

  if (timeSinceLastSync < SYNC_RATE_LIMIT) {
    await new Promise(resolve => setTimeout(resolve, SYNC_RATE_LIMIT - timeSinceLastSync));
  }

  lastSyncTime = Date.now();
  return fetch(url, options);
}

export const SupabaseService = {
  // ==================== Authentication ====================

  auth: {
    /**
     * Sign up a new user
     */
    signUp: async (
      config: SupabaseConfig,
      email: string,
      password: string,
      options?: { data?: Record<string, any> }
    ): Promise<{ user?: UserResponse; session?: SessionResponse; error?: string }> => {
      try {
        const response = await rateLimitedFetch(`${config.url}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password,
            data: options?.data
          })
        });

        const data: AuthResponse = await response.json();

        if (data.error) {
          return { error: data.error.message };
        }

        return {
          user: data.user,
          session: data.session
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: errorMessage };
      }
    },

    /**
     * Sign in with email and password
     */
    signIn: async (
      config: SupabaseConfig,
      email: string,
      password: string
    ): Promise<{ user?: UserResponse; session?: SessionResponse; error?: string }> => {
      try {
        const response = await rateLimitedFetch(`${config.url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.error) {
          return { error: data.error_description || data.error.message };
        }

        return {
          user: data.user,
          session: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            token_type: data.token_type,
            user: data.user
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: errorMessage };
      }
    },

    /**
     * Sign in with OAuth provider
     */
    signInWithOAuth: async (
      config: SupabaseConfig,
      provider: 'google' | 'github',
      options?: { redirectTo?: string; scopes?: string }
    ): Promise<{ url?: string; error?: string }> => {
      try {
        const params = new URLSearchParams({
          provider,
          redirect_to: options?.redirectTo || chrome.identity.getRedirectURL()
        });

        if (options?.scopes) {
          params.append('scopes', options.scopes);
        }

        const url = `${config.url}/auth/v1/authorize?${params.toString()}`;
        return { url };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: errorMessage };
      }
    },

    /**
     * Sign out the current user
     */
    signOut: async (config: SupabaseConfig, accessToken: string): Promise<{ error?: string }> => {
      try {
        const response = await rateLimitedFetch(`${config.url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          const data = await response.json();
          return { error: data.error_description || 'Sign out failed' };
        }

        return {};
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: errorMessage };
      }
    },

    /**
     * Get current user session
     */
    getSession: async (config: SupabaseConfig): Promise<{ session?: SessionResponse; error?: string }> => {
      try {
        const response = await rateLimitedFetch(`${config.url}/auth/v1/session`, {
          headers: {
            'apikey': config.anonKey,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (data.error) {
          return { error: data.error.message };
        }

        return { session: data.session };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: errorMessage };
      }
    },

    /**
     * Refresh access token
     */
    refreshToken: async (
      config: SupabaseConfig,
      refreshToken: string
    ): Promise<{ session?: SessionResponse; error?: string }> => {
      try {
        const response = await rateLimitedFetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });

        const data = await response.json();

        if (data.error) {
          return { error: data.error_description || data.error.message };
        }

        return {
          session: {
            access_token: data.access_token,
            refresh_token: data.refresh_token || refreshToken,
            expires_in: data.expires_in,
            token_type: data.token_type
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: errorMessage };
      }
    },

    /**
     * Send password reset email
     */
    resetPassword: async (config: SupabaseConfig, email: string): Promise<{ error?: string }> => {
      try {
        const response = await rateLimitedFetch(`${config.url}/auth/v1/recover`, {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });

        if (!response.ok) {
          const data = await response.json();
          return { error: data.error_description || data.msg };
        }

        return {};
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: errorMessage };
      }
    }
  },

  // ==================== CRUD Operations ====================

  /**
   * Create a new record
   */
  createRecord: async (
    config: SupabaseConfig,
    item: SavedItem,
    session?: UserSession
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        return { success: false, error: 'Supabase configuration missing' };
      }

      const baseUrl = config.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/rest/v1/${config.tableName}`;

      const payload = {
        title: item.title,
        content: item.content,
        url: item.url || null,
        type: item.type,
        tags: item.tags,
        created_at: new Date(item.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
        user_id: session?.user?.id
      };

      const authHeader = session?.accessToken ? `Bearer ${session.accessToken}` : `Bearer ${config.anonKey}`;

      const response = await rateLimitedFetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': config.anonKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || `Error: ${response.status}` };
      }

      // Get the created record ID from the Location header
      const location = response.headers.get('Location');
      const id = location ? location.split('/').pop() : undefined;

      return { success: true, id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Get a single record by ID
   */
  getRecord: async (
    config: SupabaseConfig,
    id: string,
    session?: UserSession
  ): Promise<{ success: boolean; data?: SavedItem; error?: string }> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        return { success: false, error: 'Supabase configuration missing' };
      }

      const baseUrl = config.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/rest/v1/${config.tableName}?id=eq.${id}`;

      const authHeader = session?.accessToken ? `Bearer ${session.accessToken}` : `Bearer ${config.anonKey}`;

      const response = await rateLimitedFetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || `Error: ${response.status}` };
      }

      const data = await response.json();
      if (data.length === 0) {
        return { success: false, error: 'Record not found' };
      }

      return {
        success: true,
        data: mapRecordToSavedItem(data[0])
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Get all records with optional filtering and pagination
   */
  getRecords: async (
    config: SupabaseConfig,
    options?: {
      session?: UserSession;
      filters?: Record<string, any>;
      orderBy?: string;
      order?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ success: boolean; data?: SavedItem[]; error?: string; total?: number }> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        return { success: false, error: 'Supabase configuration missing' };
      }

      const baseUrl = config.url.replace(/\/$/, '');
      const params = new URLSearchParams();

      if (options?.orderBy) {
        params.append('order', `${options.orderBy}.${options.order || 'desc'}`);
      }
      if (options?.limit) {
        params.append('limit', options.limit.toString());
      }
      if (options?.offset) {
        params.append('offset', options.offset.toString());
      }

      // Add filters
      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          params.append(key, value.toString());
        });
      }

      const endpoint = `${baseUrl}/rest/v1/${config.tableName}?${params.toString()}`;

      const authHeader = options?.session?.accessToken
        ? `Bearer ${options.session.accessToken}`
        : `Bearer ${config.anonKey}`;

      const response = await rateLimitedFetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || `Error: ${response.status}` };
      }

      const data = await response.json();
      const items = data.map(mapRecordToSavedItem);

      return { success: true, data: items };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Update a record
   */
  updateRecord: async (
    config: SupabaseConfig,
    id: string,
    updates: Partial<SavedItem>,
    session?: UserSession
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        return { success: false, error: 'Supabase configuration missing' };
      }

      const baseUrl = config.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/rest/v1/${config.tableName}?id=eq.${id}`;

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.content !== undefined) payload.content = updates.content;
      if (updates.url !== undefined) payload.url = updates.url;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.tags !== undefined) payload.tags = updates.tags;

      const authHeader = session?.accessToken ? `Bearer ${session.accessToken}` : `Bearer ${config.anonKey}`;

      const response = await rateLimitedFetch(endpoint, {
        method: 'PATCH',
        headers: {
          'apikey': config.anonKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || `Error: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Delete a record
   */
  deleteRecord: async (
    config: SupabaseConfig,
    id: string,
    session?: UserSession
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        return { success: false, error: 'Supabase configuration missing' };
      }

      const baseUrl = config.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/rest/v1/${config.tableName}?id=eq.${id}`;

      const authHeader = session?.accessToken ? `Bearer ${session.accessToken}` : `Bearer ${config.anonKey}`;

      const response = await rateLimitedFetch(endpoint, {
        method: 'DELETE',
        headers: {
          'apikey': config.anonKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || `Error: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  // ==================== Batch Operations ====================

  /**
   * Batch create records
   */
  batchCreate: async (
    config: SupabaseConfig,
    items: SavedItem[],
    session?: UserSession
  ): Promise<{ success: boolean; created: number; failed: number; error?: string }> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        return { success: false, created: 0, failed: 0, error: 'Supabase configuration missing' };
      }

      const baseUrl = config.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/rest/v1/${config.tableName}`;

      const authHeader = session?.accessToken ? `Bearer ${session.accessToken}` : `Bearer ${config.anonKey}`;

      // Supabase allows up to 1000 rows per batch
      const BATCH_SIZE = 1000;
      let created = 0;
      let failed = 0;

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const payload = batch.map(item => ({
          title: item.title,
          content: item.content,
          url: item.url || null,
          type: item.type,
          tags: item.tags,
          created_at: new Date(item.createdAt).toISOString(),
          user_id: session?.user?.id
        }));

        const response = await rateLimitedFetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          created += batch.length;
        } else {
          failed += batch.length;
        }
      }

      return { success: true, created, failed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, created: 0, failed: items.length, error: errorMessage };
    }
  },

  /**
   * Batch delete records by IDs
   */
  batchDelete: async (
    config: SupabaseConfig,
    ids: string[],
    session?: UserSession
  ): Promise<{ success: boolean; deleted: number; failed: number; error?: string }> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        return { success: false, deleted: 0, failed: 0, error: 'Supabase configuration missing' };
      }

      const baseUrl = config.url.replace(/\/$/, '');
      const authHeader = session?.accessToken ? `Bearer ${session.accessToken}` : `Bearer ${config.anonKey}`;

      let deleted = 0;
      let failed = 0;

      // Delete in batches
      for (const id of ids) {
        const endpoint = `${baseUrl}/rest/v1/${config.tableName}?id=eq.${id}`;

        const response = await rateLimitedFetch(endpoint, {
          method: 'DELETE',
          headers: {
            'apikey': config.anonKey,
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          deleted++;
        } else {
          failed++;
        }
      }

      return { success: true, deleted, failed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, deleted: 0, failed: ids.length, error: errorMessage };
    }
  },

  // ==================== Sync Operations ====================

  /**
   * Sync items that are pending or have errors
   */
  syncPendingItems: async (
    config: SupabaseConfig,
    items: SavedItem[],
    session?: UserSession
  ): Promise<{ synced: number; failed: number; errors: string[] }> => {
    const results = { synced: 0, failed: 0, errors: [] as string[] };

    for (const item of items) {
      const result = await SupabaseService.createRecord(config, item, session);

      if (result.success) {
        results.synced++;
      } else {
        results.failed++;
        results.errors.push(`${item.id}: ${result.error}`);
      }

      // Small delay between sync operations
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return results;
  },

  /**
   * Pull remote changes (for two-way sync)
   */
  pullChanges: async (
    config: SupabaseConfig,
    session: UserSession,
    lastSyncTime?: number
  ): Promise<{ success: boolean; data?: SavedItem[]; error?: string }> => {
    try {
      const filters: Record<string, any> = {};

      if (lastSyncTime) {
        filters.created_at = `gte.${new Date(lastSyncTime).toISOString()}`;
      }

      return await SupabaseService.getRecords(config, {
        session,
        filters,
        orderBy: 'created_at',
        order: 'desc'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
};

/**
 * Map database record to SavedItem
 */
function mapRecordToSavedItem(record: any): SavedItem {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    content: record.content,
    url: record.url,
    tags: record.tags || [],
    createdAt: new Date(record.created_at).getTime(),
    syncStatus: 'synced'
  };
}
