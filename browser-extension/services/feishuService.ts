import { FeishuConfig, SavedItem } from '../types';

/**
 * Feishu Service - Production-ready API integration
 *
 * NOTE: For production use, API calls should be routed through the background script
 * to avoid CORS issues. This service can be used directly in the background script
 * or with a proper backend proxy.
 */

interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

interface FeishuRecordResponse {
  code: number;
  msg: string;
  data: {
    record_id?: string;
  };
}

interface FeishuAppTokenResponse {
  code: number;
  msg: string;
  data: {
    app_token?: string;
    name?: string;
  };
}

// Token cache to reduce API calls
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get cached or fresh tenant access token
 */
async function getTenantAccessToken(config: FeishuConfig): Promise<string> {
  // Check cache first
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  // Check if credentials are configured
  if (!config.appId || !config.appSecret) {
    throw new Error('Feishu App ID and Secret are not configured');
  }

  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret
      })
    });

    const data: TenantAccessTokenResponse = await response.json();

    if (data.code !== 0) {
      throw new Error(`Feishu Auth Error: ${data.msg} (Code: ${data.code})`);
    }

    // Cache the token (expire 5 minutes early to be safe)
    cachedToken = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + (data.expire - 300) * 1000
    };

    return data.tenant_access_token;
  } catch (error) {
    console.error('Failed to get Feishu tenant access token:', error);
    throw error;
  }
}

/**
 * Clear cached token (useful when token expires)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Validate Feishu configuration
 */
export async function validateConfig(config: FeishuConfig): Promise<{ valid: boolean; error?: string }> {
  if (!config.appId || !config.appSecret) {
    return { valid: false, error: 'App ID and Secret are required' };
  }

  if (!config.appToken) {
    return { valid: false, error: 'App Token is required' };
  }

  if (!config.tableId) {
    return { valid: false, error: 'Table ID is required' };
  }

  try {
    // Try to get tenant access token to validate credentials
    await getTenantAccessToken(config);

    // Verify app token exists
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}`,
      {
        headers: {
          'Authorization': `Bearer ${cachedToken?.token}`
        }
      }
    );

    const data: FeishuAppTokenResponse = await response.json();
    if (data.code !== 0) {
      return { valid: false, error: `App Token invalid: ${data.msg}` };
    }

    return { valid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: errorMessage };
  }
}

export const FeishuService = {
  /**
   * Create a record in Feishu Base
   */
  createRecord: async (config: FeishuConfig, item: SavedItem): Promise<{ success: boolean; recordId?: string; error?: string }> => {
    try {
      // Validate configuration
      if (!config.appToken || !config.tableId) {
        return { success: false, error: 'Feishu Base is not configured' };
      }

      const token = await getTenantAccessToken(config);

      // Map SavedItem to Feishu Base Fields
      // Assumes Base has fields: "Title" (Text), "Content" (Rich Text), "URL" (Url), "Type" (Single Select), "Tags" (Multi Select), "CreatedAt" (DateTime)
      const fields: Record<string, any> = {
        'Title': item.title,
        'Type': item.type === 'link' ? 'Link' : 'Note',
        'Tags': item.tags,
        'CreatedAt': new Date(item.createdAt).toISOString()
      };

      // Only add URL for links
      if (item.type === 'link' && item.url) {
        fields['URL'] = item.url;
      }

      // Add content (supports markdown)
      if (item.content) {
        fields['Content'] = item.content;
      }

      const endpoint = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });

      const data: FeishuRecordResponse = await response.json();

      if (data.code !== 0) {
        console.error('Feishu create record error:', data.msg);
        return { success: false, error: data.msg };
      }

      return { success: true, recordId: data.data?.record_id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Feishu sync error:', error);
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Get a record from Feishu Base
   */
  getRecord: async (config: FeishuConfig, recordId: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      if (!config.appToken || !config.tableId) {
        return { success: false, error: 'Feishu Base is not configured' };
      }

      const token = await getTenantAccessToken(config);

      const endpoint = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.code !== 0) {
        return { success: false, error: data.msg };
      }

      return { success: true, data: data.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Update a record in Feishu Base
   */
  updateRecord: async (config: FeishuConfig, recordId: string, updates: Partial<SavedItem>): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!config.appToken || !config.tableId) {
        return { success: false, error: 'Feishu Base is not configured' };
      }

      const token = await getTenantAccessToken(config);

      const fields: Record<string, any> = {};
      if (updates.title) fields['Title'] = updates.title;
      if (updates.content) fields['Content'] = updates.content;
      if (updates.url) fields['URL'] = updates.url;
      if (updates.tags) fields['Tags'] = updates.tags;

      const endpoint = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });

      const data = await response.json();

      if (data.code !== 0) {
        return { success: false, error: data.msg };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Delete a record from Feishu Base
   */
  deleteRecord: async (config: FeishuConfig, recordId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!config.appToken || !config.tableId) {
        return { success: false, error: 'Feishu Base is not configured' };
      }

      const token = await getTenantAccessToken(config);

      const endpoint = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.code !== 0) {
        return { success: false, error: data.msg };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * List records from Feishu Base
   */
  listRecords: async (config: FeishuConfig, options?: { pageSize?: number; pageToken?: string }): Promise<{ success: boolean; data?: any[]; error?: string }> => {
    try {
      if (!config.appToken || !config.tableId) {
        return { success: false, error: 'Feishu Base is not configured' };
      }

      const token = await getTenantAccessToken(config);
      const pageSize = options?.pageSize || 100;

      let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records?page_size=${pageSize}`;
      if (options?.pageToken) {
        url += `&page_token=${options.pageToken}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.code !== 0) {
        return { success: false, error: data.msg };
      }

      return { success: true, data: data.data?.items || [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Batch create records in Feishu Base (for bulk sync)
   */
  batchCreateRecords: async (config: FeishuConfig, items: SavedItem[]): Promise<{ success: boolean; created: number; failed: number; error?: string }> => {
    try {
      if (!config.appToken || !config.tableId) {
        return { success: false, created: 0, failed: 0, error: 'Feishu Base is not configured' };
      }

      const token = await getTenantAccessToken(config);

      // Feishu API allows up to 500 records per batch
      const BATCH_SIZE = 500;
      let created = 0;
      let failed = 0;

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const records = batch.map(item => ({
          fields: {
            'Title': item.title,
            'Content': item.content,
            'URL': item.type === 'link' ? item.url : undefined,
            'Type': item.type === 'link' ? 'Link' : 'Note',
            'Tags': item.tags,
            'CreatedAt': new Date(item.createdAt).toISOString()
          }
        }));

        const endpoint = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/batch_create`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ records })
        });

        const data = await response.json();

        if (data.code !== 0) {
          console.error('Feishu batch create error:', data.msg);
          failed += batch.length;
        } else {
          const successCount = data.data?.items?.length || batch.length;
          created += successCount;
          failed += batch.length - successCount;
        }
      }

      return { success: true, created, failed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, created: 0, failed: items.length, error: errorMessage };
    }
  },

  /**
   * Get table schema to help users configure their Base
   */
  getTableSchema: async (config: FeishuConfig): Promise<{ success: boolean; fields?: any[]; error?: string }> => {
    try {
      if (!config.appToken || !config.tableId) {
        return { success: false, error: 'Feishu Base is not configured' };
      }

      const token = await getTenantAccessToken(config);

      const response = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/fields`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (data.code !== 0) {
        return { success: false, error: data.msg };
      }

      return { success: true, fields: data.data?.items || [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Validate and get configuration help
   */
  getConfigurationHelp: async (config: FeishuConfig): Promise<{ valid: boolean; message: string; requiredFields?: string[] }> => {
    const requiredFields = ['Title', 'Content', 'URL', 'Type', 'Tags', 'CreatedAt'];

    const validation = await validateConfig(config);
    if (!validation.valid) {
      return { valid: false, message: validation.error || 'Configuration invalid' };
    }

    const schemaResult = await FeishuService.getTableSchema(config);
    if (!schemaResult.success) {
      return {
        valid: true,
        message: 'Base connected but could not verify field configuration. Please ensure you have fields named: Title, Content, URL, Type, Tags, CreatedAt',
        requiredFields
      };
    }

    const existingFields = schemaResult.fields?.map(f => f.field_name) || [];
    const missingFields = requiredFields.filter(f => !existingFields.includes(f));

    if (missingFields.length > 0) {
      return {
        valid: true,
        message: `Base connected. Missing recommended fields: ${missingFields.join(', ')}`,
        requiredFields
      };
    }

    return {
      valid: true,
      message: 'Base configuration is complete and valid!'
    };
  }
};
