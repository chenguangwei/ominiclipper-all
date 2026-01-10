export type ItemType = 'link' | 'note';

export interface SavedItem {
  id: string;
  type: ItemType;
  title: string;
  content: string; // Markdown or Description
  url?: string;
  tags: string[];
  createdAt: number;
  synced: boolean;
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string; // The Base token
  tableId: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
  };
  accessToken: string;
  expiresAt: number;
}

export interface Subscription {
  plan: 'free' | 'monthly' | 'yearly';
  isActive: boolean;
  expiryDate?: number;
}

export interface AppSettings {
  storageMode: 'local' | 'feishu' | 'supabase';
  feishuConfig: FeishuConfig;
  supabaseConfig: SupabaseConfig;
  userSession?: UserSession;
  subscription: Subscription;
}

export enum ViewState {
  CAPTURE = 'CAPTURE',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS'
}

export const TAG_OPTIONS = [
  'Work', 'Inspiration', 'Dev', 'Design', 'Reading', 'Tool', 'Other'
];