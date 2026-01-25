import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import Icon from './Icon';
import ResourcePreview from './PreviewPane/ResourcePreview';
import { chatService } from '../services/chatService';
import { hybridSearchService } from '../services/hybridSearchService';
import { subscriptionManager } from '../services/subscriptionManager';
import { llmProviderService } from '../services/llmProvider';
import { ChatMessage, SearchResult } from '../types/chat';
import { ResourceItem, ColorMode } from '../types';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToItem?: (itemId: string, highlightText?: string) => void;
  items?: ResourceItem[];
  colorMode?: ColorMode;
  onViewItem?: (item: ResourceItem) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  onNavigateToItem,
  items = [],
  colorMode = 'dark',
  onViewItem
}) => {
  // ... (state remains same)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<ResourceItem | null>(null);
  const [previewHighlight, setPreviewHighlight] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ... (effects remain same)

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
    if (!isOpen) {
      // Reset preview when closed
      setPreviewItem(null);
      setPreviewHighlight(null);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSourceClickInChat = (docId: string, title?: string, text?: string) => {
    // Try to find the item locally first for split view
    const item = items.find(i => i.id === docId);

    if (item) {
      setPreviewItem(item);
      setPreviewHighlight(text || null);
    } else {
      // Fallback to navigation if not found (or some other logic)
      if (onNavigateToItem) {
        onNavigateToItem(docId, text);
      }
    }
  };

  const handleClosePreview = () => {
    setPreviewItem(null);
    setPreviewHighlight(null);
  };

  // ... (handlers remain same)

  // Only changing the ResourcePreview rendering part in return

  // ... (render remains same up to ResourcePreview)

  // Inside the return JSX, locating ResourcePreview:
  /*
               <div className="flex-1 overflow-hidden bg-surface relative">
                 <ResourcePreview 
                   item={previewItem} 
                   activeTab="preview" 
                   colorMode={colorMode}
                   highlightText={previewHighlight}
                   onOpenDocument={onViewItem} 
                 />
               </div>
  */

  // Changing the Props interface and destructuring first

  // ... (handleSend and handleClear remain mostly the same, ensuring we pass handleSourceClickInChat)

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
      const savedProvider = localStorage.getItem('OMNICLIPPER_DEFAULT_PROVIDER') as any || 'openai';

      let fullResponse = '';

      chatService.addMessage('assistant', '', []);
      setMessages([...chatService.getMessages()]);

      console.log('[AIAssistant] Full Prompt Context:', context);
      console.log('[AIAssistant] Full Prompt Question:', question);
      console.log('[AIAssistant] Message History:', chatService.buildContextForLLM());

      await llmProviderService.chatWithContext(
        context,
        question,
        chatService.buildContextForLLM(),
        (token) => {
          fullResponse += token;
          const currentMessages = chatService.getMessages();
          const lastMsg = currentMessages[currentMessages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = fullResponse;
            setMessages([...currentMessages]);
          }
        },
        { provider: savedProvider }
      );

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

      {/* Main Container - Expands when preview is active */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex
          transition-all duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${previewItem ? 'w-full' : 'w-[420px] max-w-[90vw]'}`}
      >

        {/* Left Side: Preview Pane (Visible only when item selected) */}
        {previewItem && (
          <div className="flex-1 flex flex-col bg-surface border-l border-[rgb(var(--color-border)/var(--border-opacity))] shadow-2xl overflow-hidden animate-fade-in">
            <div className="h-14 border-b border-[rgb(var(--color-border)/var(--border-opacity))] flex items-center justify-between px-4 bg-surface-secondary">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className={`p-1.5 rounded-md ${colorMode === 'light' ? 'bg-gray-200' : 'bg-surface-tertiary'}`}>
                  <Icon name="description" className="text-[14px]" />
                </div>
                <span className="text-sm font-medium truncate">{previewItem.title}</span>
              </div>
              <div className="flex items-center gap-1">
                {onNavigateToItem && (
                  <button
                    onClick={() => onNavigateToItem(previewItem.id, previewHighlight || undefined)}
                    className="p-2 rounded-lg text-content-secondary hover:text-content hover:bg-surface-tertiary transition-colors"
                    title="Open in Main Window"
                  >
                    <Icon name="open_in_new" className="text-[18px]" />
                  </button>
                )}
                <button
                  onClick={handleClosePreview}
                  className="p-2 rounded-lg text-content-secondary hover:text-content hover:bg-surface-tertiary transition-colors"
                >
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-surface relative">
              <ResourcePreview
                item={previewItem}
                activeTab="preview"
                colorMode={colorMode}
                highlightText={previewHighlight}
                onOpenDocument={onViewItem}
              />
            </div>
          </div>
        )}

        {/* Right Side: Chat Panel */}
        <div className="w-[420px] shrink-0 flex flex-col bg-surface border-l border-[rgb(var(--color-border)/var(--border-opacity))] shadow-2xl relative">

          {/* Header */}
          <div className="h-14 border-b border-[rgb(var(--color-border)/var(--border-opacity))] flex items-center justify-between px-4 bg-surface-secondary">
            {/* Same Header as before */}
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
              <MessageItem
                key={msg.id}
                message={msg}
                onSourceClick={handleSourceClickInChat}
              />
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
      </div>
    </>
  );
};

interface MessageItemProps {
  message: ChatMessage;
  onSourceClick: (docId: string, title?: string, text?: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onSourceClick }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser
        ? 'bg-primary text-white rounded-br-md'
        : 'bg-surface-tertiary text-content rounded-bl-md border border-[rgb(var(--color-border)/var(--border-opacity))]'
        }`}>
        <div className={`text-sm leading-relaxed prose prose-sm max-w-none ${isUser ? 'text-white' : 'text-content dark:prose-invert'}`}>
          <Markdown>{message.content}</Markdown>
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className={`mt-3 pt-3 border-t ${isUser ? 'border-white/10' : 'border-[rgb(var(--color-border)/var(--border-opacity))]'}`}>
            <p className={`text-[10px] mb-2 uppercase tracking-wide font-medium ${isUser ? 'text-white/60' : 'text-content-secondary'}`}>Sources</p>
            <div className="flex flex-wrap gap-1">
              {message.sources.map((s, i) => (
                <button
                  key={`${s.id}-${i}`}
                  onClick={() => onSourceClick(s.id, s.title, s.text)}
                  className={`text-[11px] px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity text-left max-w-full truncate ${isUser ? 'bg-white/20 text-white/90' : 'bg-primary/10 text-primary'}`}
                  title="Click to view context"
                >
                  {s.title || 'Untitled'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
