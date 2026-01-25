import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { chatService } from '../services/chatService';
import { hybridSearchService } from '../services/hybridSearchService';
import { subscriptionManager } from '../services/subscriptionManager';
import { llmProviderService } from '../services/llmProvider';
import { ChatMessage, SearchResult } from '../types/chat';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hi! I\'m the OmniClipper AI Assistant. How can I help you search your collection?',
        timestamp: Date.now(),
      }]);
    }
    // Focus input when opened
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput('');
    setIsLoading(true);

    chatService.addMessage('user', question);
    setMessages([...chatService.getMessages()]);

    try {
      const canUse = await subscriptionManager.canUseAI();
      if (!canUse) {
        const remaining = subscriptionManager.getRemainingQuota();
        chatService.addMessage('assistant', `Monthly AI quota exhausted. Remaining: ${remaining} tokens`);
        setMessages([...chatService.getMessages()]);
        return;
      }

      const results = await hybridSearchService.search({ query: question, limit: 5 });
      const context = results.map(r => r.text).join('\n\n');

      // Determine provider from settings (or default)
      // In a real app we'd have a useSettings hook. For now, let's grab from localStorage safely
      const savedProvider = localStorage.getItem('OMNICLIPPER_DEFAULT_PROVIDER') as any || 'openai';

      let fullResponse = '';

      // Add placeholder message for streaming
      chatService.addMessage('assistant', '', []);
      setMessages([...chatService.getMessages()]);

      await llmProviderService.chatWithContext(
        context,
        question,
        chatService.buildContextForLLM(),
        (token) => {
          fullResponse += token;
          const currentMessages = chatService.getMessages();
          const lastMsg = currentMessages[currentMessages.length - 1];
          // ... (keep existing update logic)
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = fullResponse;
            setMessages([...currentMessages]);
          }
        },
        { provider: savedProvider }
      );

      // Update with sources
      const currentMessages = chatService.getMessages();
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = fullResponse;
        lastMsg.sources = results;
        setMessages([...currentMessages]);
      }

      const estimatedTokens = Math.ceil(fullResponse.length / 4);
      subscriptionManager.updateUsage(estimatedTokens);
    } catch (error) {
      console.error('AI Assistant error:', error);
      chatService.addMessage('assistant', 'Sorry, an error occurred. Please try again.');
      setMessages([...chatService.getMessages()]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    chatService.clear();
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m the OmniClipper AI Assistant. How can I help you search your collection?',
      timestamp: Date.now(),
    }]);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] z-50
          bg-surface border-l border-[rgb(var(--color-border)/var(--border-opacity))]
          shadow-2xl flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="h-14 border-b border-[rgb(var(--color-border)/var(--border-opacity))] flex items-center justify-between px-4 bg-surface-secondary">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <Icon name="smart_toy" className="text-white text-[18px]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content">AI Assistant</h3>
              <p className="text-[10px] text-content-secondary">Chat with your collection</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="p-2 rounded-lg text-content-secondary hover:text-content hover:bg-surface-tertiary transition-colors"
              title="Clear conversation"
            >
              <Icon name="delete_sweep" className="text-[18px]" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-content-secondary hover:text-content hover:bg-surface-tertiary transition-colors"
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map(msg => (
            <MessageItem key={msg.id} message={msg} />
          ))}
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="flex items-center gap-2 text-content-secondary text-sm px-3 py-2">
              <Icon name="progress_activity" className="animate-spin text-primary" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-secondary">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about your collection..."
              className="w-full bg-surface border border-[rgb(var(--color-border)/var(--border-opacity))]
                rounded-xl px-4 py-3 pr-12 text-sm text-content placeholder-content-secondary
                resize-none focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none
                transition-all"
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 bottom-3 p-2 rounded-lg bg-primary text-white
                hover:bg-primary/90 disabled:bg-surface-tertiary disabled:text-content-secondary
                transition-colors"
            >
              <Icon name="send" className="text-[16px]" />
            </button>
          </div>
          <p className="text-[10px] text-content-secondary mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
};

const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser
        ? 'bg-primary text-white rounded-br-md'
        : 'bg-surface-tertiary text-content rounded-bl-md border border-[rgb(var(--color-border)/var(--border-opacity))]'
        }`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.sources && message.sources.length > 0 && (
          <div className={`mt-3 pt-3 border-t ${isUser ? 'border-white/10' : 'border-[rgb(var(--color-border)/var(--border-opacity))]'}`}>
            <p className={`text-[10px] mb-2 uppercase tracking-wide font-medium ${isUser ? 'text-white/60' : 'text-content-secondary'}`}>Sources</p>
            <div className="flex flex-wrap gap-1">
              {message.sources.map((s, i) => (
                <span
                  key={s.id}
                  className={`text-[11px] px-2 py-0.5 rounded-full ${isUser ? 'bg-white/20 text-white/90' : 'bg-primary/10 text-primary'}`}
                >
                  {s.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
