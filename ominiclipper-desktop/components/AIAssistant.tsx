import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { chatService } from '../src/services/chatService';
import { hybridSearchService } from '../src/services/hybridSearchService';
import { subscriptionManager } from '../services/subscriptionManager';
import { llmProviderService } from '../services/llmProvider';
import { ChatMessage, SearchResult } from '../src/types/chat';

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

    // 添加临时的空回复消息用于显示流式输出
    const tempMessageId = crypto.randomUUID();
    chatService.addMessage('assistant', '', []);
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
      const context = results.map(r => r.text).join('\n\n');

      let fullResponse = '';

      // 使用流式输出
      await llmProviderService.chatWithContext(
        context,
        question,
        chatService.buildContextForLLM(),
        (token) => {
          fullResponse += token;
          // 实时更新 UI
          const currentMessages = chatService.getMessages();
          const lastMsgIndex = currentMessages.findIndex(m => m.role === 'assistant');
          if (lastMsgIndex !== -1) {
            currentMessages[lastMsgIndex].content = fullResponse;
            setMessages([...currentMessages]);
          }
        }
      );

      // 更新完整响应和来源信息
      const currentMessages = chatService.getMessages();
      const lastMsgIndex = currentMessages.findIndex(m => m.role === 'assistant');
      if (lastMsgIndex !== -1) {
        currentMessages[lastMsgIndex].content = fullResponse;
        currentMessages[lastMsgIndex].sources = results;
        setMessages([...currentMessages]);
      }

      // 更新 Token 使用量（模拟值，实际项目中从 API 响应获取）
      const estimatedTokens = Math.ceil(fullResponse.length / 4);
      subscriptionManager.updateUsage(estimatedTokens);
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
