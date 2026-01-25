
import { vectorStoreService } from './vectorStoreService';
import { ChatMessage, ChatResponse, SearchResult } from '../types/chat';

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3';

export class ChatService {
  private messages: ChatMessage[] = [];

  constructor() {
    this.messages = [];
  }

  addMessage(role: 'user' | 'assistant', content: string, sources?: SearchResult[]) {
    const msg: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      role,
      content,
      sources,
      timestamp: Date.now()
    };
    this.messages.push(msg);
    return msg;
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  clear() {
    this.messages = [];
  }

  buildContextForLLM(): { role: string; content: string }[] {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content
    }));
  }

  async sendMessage(query: string, history: ChatMessage[] = []): Promise<ChatResponse> {
    // 1. Retrieve context
    console.log('[ChatService] Retrieving context for:', query);
    const results = await vectorStoreService.hybridSearch(query, 5);

    // Format context
    const contextText = results.map(r => `[${r.metadata.title}]: ${r.text}`).join('\n\n');
    const sources = results.map(r => ({
      id: r.id,
      title: r.metadata.title,
      type: r.metadata.type,
      text: r.text,
      score: r.score
    }));

    // Simple check if passing through to internal generation (if needed by legacy callers)
    // But primarily this service is now a state container for AIAssistant
    return {
      content: '',
      sources: sources,
      tokens: { input: 0, output: 0 }
    };
  }
}

export const chatService = new ChatService();
