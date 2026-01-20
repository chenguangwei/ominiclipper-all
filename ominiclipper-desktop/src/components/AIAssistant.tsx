import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { chatService } from '../services/chatService';
import { hybridSearchService } from '../services/hybridSearchService';
import { subscriptionManager } from '../services/subscriptionManager';
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

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '你好！我是 OmniClipper AI 助手。有什么可以帮你查找的吗？',
        timestamp: Date.now(),
      }]);
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
        chatService.addMessage('assistant', `本月 AI 配额已用完。剩余: ${remaining} tokens`);
        setMessages([...chatService.getMessages()]);
        return;
      }

      const results = await hybridSearchService.search({ query: question, limit: 5 });
      const response = await mockLLMCall(question, results);

      chatService.addMessage('assistant', response.content, response.sources);
      setMessages([...chatService.getMessages()]);

      subscriptionManager.updateUsage(response.tokens.output);
    } catch (error) {
      console.error('AI Assistant error:', error);
      chatService.addMessage('assistant', '抱歉，发生了错误。请重试。');
      setMessages([...chatService.getMessages()]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-0 bottom-0 w-96 bg-[#1a1a1a] border-r border-white/10 flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4">
        <span className="text-sm font-medium text-white">AI 助手</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <Icon name="close" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Icon name="progress_activity" className="animate-spin" />
            思考中...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入问题..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:border-primary outline-none"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 p-1 text-primary hover:text-primary/80 disabled:text-slate-600"
          >
            <Icon name="send" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
        isUser ? 'bg-primary text-white' : 'bg-surface-tertiary text-slate-200'
      }`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-xs text-slate-400 mb-1">来源:</p>
            {message.sources.map((s, i) => (
              <span key={s.id} className="text-xs text-primary">
                [{i + 1}] {s.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;

// Mock LLM call (临时)
async function mockLLMCall(question: string, results: SearchResult[]) {
  const context = results.map(r => r.text).join('\n\n');
  return {
    content: `根据搜索结果，关于"${question}"的信息：\n\n这是模拟的 AI 响应。在实际实现中，将调用 LLM Provider。`,
    sources: results,
    tokens: { input: 100, output: 50 },
  };
}
