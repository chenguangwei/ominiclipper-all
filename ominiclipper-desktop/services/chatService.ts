// src/services/chatService.ts

import { ChatMessage, SearchResult } from '../types/chat';

const MAX_ROUNDS = 10;

export class ChatService {
  private messages: ChatMessage[] = [];

  addMessage(role: 'user' | 'assistant', content: string, sources?: SearchResult[]): ChatMessage {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      sources,
      timestamp: Date.now(),
    };
    this.messages.push(message);
    this.pruneIfNeeded();
    return message;
  }

  private pruneIfNeeded(): void {
    const maxMessages = MAX_ROUNDS * 2;
    if (this.messages.length > maxMessages) {
      this.messages = this.messages.slice(-maxMessages);
    }
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  buildContextForLLM(): string {
    return this.messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
  }
}

export const chatService = new ChatService();
