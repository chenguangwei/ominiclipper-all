/**
 * Feishu Service Proxy
 *
 * This proxy routes all Feishu API calls through the background script
 * to avoid CORS issues in popup/content script contexts.
 *
 * Usage:
 *   import { FeishuServiceProxy } from './feishuServiceProxy';
 *   const result = await FeishuServiceProxy.createRecord(config, item);
 */

import { FeishuConfig, ResourceItem } from '../types';

/**
 * Send message to background script and wait for response
 */
async function sendToBackground<T>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

export const FeishuServiceProxy = {
  /**
   * Validate Feishu configuration
   */
  validateConfig: async (config: FeishuConfig): Promise<{ valid: boolean; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_VALIDATE_CONFIG',
      config
    });
  },

  /**
   * Create a record in Feishu Base
   */
  createRecord: async (
    config: FeishuConfig,
    item: ResourceItem
  ): Promise<{ success: boolean; recordId?: string; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_CREATE_RECORD',
      config,
      item
    });
  },

  /**
   * Get a record from Feishu Base
   */
  getRecord: async (
    config: FeishuConfig,
    recordId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_GET_RECORD',
      config,
      recordId
    });
  },

  /**
   * Update a record in Feishu Base
   */
  updateRecord: async (
    config: FeishuConfig,
    recordId: string,
    updates: Partial<ResourceItem>
  ): Promise<{ success: boolean; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_UPDATE_RECORD',
      config,
      recordId,
      updates
    });
  },

  /**
   * Delete a record from Feishu Base
   */
  deleteRecord: async (
    config: FeishuConfig,
    recordId: string
  ): Promise<{ success: boolean; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_DELETE_RECORD',
      config,
      recordId
    });
  },

  /**
   * List records from Feishu Base
   */
  listRecords: async (
    config: FeishuConfig,
    options?: { pageSize?: number; pageToken?: string }
  ): Promise<{ success: boolean; data?: any[]; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_LIST_RECORDS',
      config,
      options
    });
  },

  /**
   * Batch create records in Feishu Base
   */
  batchCreateRecords: async (
    config: FeishuConfig,
    items: ResourceItem[]
  ): Promise<{ success: boolean; created: number; failed: number; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_BATCH_CREATE',
      config,
      items
    });
  },

  /**
   * Get table schema
   */
  getTableSchema: async (
    config: FeishuConfig
  ): Promise<{ success: boolean; fields?: any[]; error?: string }> => {
    return sendToBackground({
      type: 'FEISHU_GET_SCHEMA',
      config
    });
  },

  /**
   * Get configuration help
   */
  getConfigurationHelp: async (
    config: FeishuConfig
  ): Promise<{ valid: boolean; message: string; requiredFields?: string[] }> => {
    return sendToBackground({
      type: 'FEISHU_GET_CONFIG_HELP',
      config
    });
  },

  /**
   * Clear token cache
   */
  clearTokenCache: async (): Promise<{ success: boolean }> => {
    return sendToBackground({
      type: 'FEISHU_CLEAR_TOKEN_CACHE'
    });
  }
};

export default FeishuServiceProxy;
