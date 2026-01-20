// Chat types for AI Assistant

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchResult[];
  timestamp: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface SearchResult {
  id: string;
  title: string;
  type: string;
  text: string;
  score: number;
}

export interface ChatResponse {
  content: string;
  sources: SearchResult[];
  tokens: {
    input: number;
    output: number;
  };
}
