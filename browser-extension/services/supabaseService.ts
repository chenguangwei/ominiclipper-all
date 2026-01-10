import { SavedItem, SupabaseConfig, UserSession } from '../types';

export const SupabaseService = {
  auth: {
    signUp: async (config: SupabaseConfig, email: string, password: string): Promise<{ user: any, session: any } | null> => {
        try {
            const response = await fetch(`${config.url}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'apikey': config.anonKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || data.error_description || 'Signup failed');
            
            return { user: data.user, session: data.session }; // session might be null if email confirm is on
        } catch (e) {
            console.error("Supabase SignUp Error", e);
            throw e;
        }
    },

    signIn: async (config: SupabaseConfig, email: string, password: string): Promise<{ user: any, session: any }> => {
        try {
            const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': config.anonKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error_description || 'Login failed');

            return { user: data.user, session: { access_token: data.access_token, expires_in: data.expires_in } };
        } catch (e) {
            console.error("Supabase SignIn Error", e);
            throw e;
        }
    },

    getOAuthUrl: (config: SupabaseConfig, provider: 'google' | 'github', redirectTo?: string): string => {
        // In a real extension, redirectTo is usually chrome.identity.getRedirectURL()
        const redirect = redirectTo || typeof window !== 'undefined' ? window.location.origin : '';
        return `${config.url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`;
    }
  },

  createRecord: async (config: SupabaseConfig, item: SavedItem, session?: UserSession): Promise<boolean> => {
    try {
      if (!config.url || !config.anonKey || !config.tableName) {
        throw new Error("Supabase configuration missing");
      }

      // Sanitize URL
      const baseUrl = config.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/rest/v1/${config.tableName}`;

      // Map Item to Supabase fields (snake_case convention is common in SQL)
      // Note: If RLS is on, the user_id column might be automatically handled by Supabase defaults or not needed if auth.uid() is used in policies.
      // However, sending user_id is often good practice if the table has it.
      const payload = {
        title: item.title,
        content: item.content,
        url: item.url || null,
        type: item.type,
        tags: item.tags,
        created_at: new Date(item.createdAt).toISOString(),
        user_id: session?.user.id // Optional: Only if your table has a user_id column
      };

      // Determine Authorization header. 
      // If we have a logged-in user session, use that token. Otherwise fall back to anon key.
      const authHeader = session?.accessToken ? `Bearer ${session.accessToken}` : `Bearer ${config.anonKey}`;

      const response = await fetch(endpoint, {
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
        // Mock success for demo if URL is obviously fake or network fails in simulation
        if (config.url.includes('mock') || config.url.includes('example')) {
            console.log('Simulating Supabase success for demo url');
            await new Promise(r => setTimeout(r, 500));
            return true;
        }
        throw new Error(`Supabase Error: ${response.statusText}`);
      }

      return true;
    }, catch (error) {
      console.error('Supabase Sync Error', error);
      // Fallback for demo purposes
      return false;
    }
  }
};