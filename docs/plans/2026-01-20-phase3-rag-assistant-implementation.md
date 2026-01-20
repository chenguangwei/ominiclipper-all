# Phase 3: RAG AI 助手实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Worktree:** `.worktrees/feature-phase3-rag-assistant`

**Goal:** 实现 AI 助手对话功能，用户可以"与数据对话"

**Architecture:** 侧边栏展开面板 + 10轮上下文 + 混合检索 + 云端 LLM

**Tech Stack:** React + TypeScript + LanceDB + Supabase

---

## 任务清单

### Task 1: 创建类型定义

**文件:**
- Create: `ominiclipper-desktop/src/types/chat.ts`

**Step 1: 定义对话类型**

```typescript
// src/types/chat.ts

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
```

**Step 2: 运行 TypeScript 检查**

```bash
cd ominiclipper-desktop && npx tsc --noEmit
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add src/types/chat.ts
git commit -m "feat: add chat type definitions"
```

---

### Task 2: 创建对话服务

**文件:**
- Create: `ominiclipper-desktop/src/services/chatService.ts`

**Step 1: 实现对话管理器**

```typescript
// src/services/chatService.ts

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
    // 只保留最近 MAX_ROUNDS * 2 条消息（user + assistant）
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
```

**Step 2: 提交**

```bash
git add src/services/chatService.ts
git commit -m "feat: add chat service for conversation management"
```

---

### Task 3: 创建混合检索服务

**文件:**
- Create: `ominiclipper-desktop/src/services/hybridSearchService.ts`

**Step 1: 实现混合检索**

```typescript
// src/services/hybridSearchService.ts

export interface HybridSearchOptions {
  query: string;
  limit?: number;
  vectorWeight?: number;
  bm25Weight?: number;
}

export class HybridSearchService {
  async search(opts: HybridSearchOptions): Promise<SearchResult[]> {
    const { query, limit = 5, vectorWeight = 0.6, bm25Weight = 0.4 } = opts;

    // 并行执行两种检索
    const [vectorResults, bm25Results] = await Promise.all([
      this.vectorSearch(query, limit * 2),
      this.bm25Search(query, limit * 2),
    ]);

    // 融合结果
    return this.fuseResults(vectorResults, bm25Results, vectorWeight, bm25Weight, limit);
  }

  private async vectorSearch(query: string, limit: number): Promise<SearchResult[]> {
    // TODO: 集成 LanceDB 向量搜索
    // return window.electron?.vectorStore.search(query, limit) || [];
    return [];
  }

  private async bm25Search(query: string, limit: number): Promise<SearchResult[]> {
    // TODO: 集成现有 FTS5 搜索
    // 复用 storageService 的搜索功能
    return [];
  }

  private fuseResults(
    vector: SearchResult[],
    bm25: SearchResult[],
    vWeight: number,
    bWeight: number,
    limit: number
  ): SearchResult[] {
    const scoreMap = new Map<string, number>();
    const sourceMap = new Map<string, SearchResult>();

    // 计算向量分数
    vector.forEach((r, i) => {
      const score = (1 - i / vector.length) * vWeight;
      scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + score);
      sourceMap.set(r.id, r);
    });

    // 计算 BM25 分数
    bm25.forEach((r, i) => {
      const score = (1 - i / bm25.length) * bWeight;
      scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + score);
      sourceMap.set(r.id, r);
    });

    // 排序并返回 Top-K
    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => sourceMap.get(id)!)
      .filter(Boolean);
  }
}

export const hybridSearchService = new HybridSearchService();
```

**Step 2: 提交**

```bash
git add src/services/hybridSearchService.ts
git commit -m "feat: add hybrid search service (vector + BM25)"
```

---

### Task 4: 创建 AIAssistant 组件

**文件:**
- Create: `ominiclipper-desktop/src/components/AIAssistant.tsx`

**Step 1: 实现主组件**

```tsx
// src/components/AIAssistant.tsx

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
      // 首次打开，显示欢迎语
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

    // 添加用户消息
    chatService.addMessage('user', question);
    setMessages([...chatService.getMessages()]);

    try {
      // 检查配额
      const canUse = await subscriptionManager.canUseAI();
      if (!canUse) {
        const remaining = subscriptionManager.getRemainingQuota();
        chatService.addMessage('assistant', `本月 AI 配额已用完。剩余: ${remaining} tokens`);
        setMessages([...chatService.getMessages()]);
        return;
      }

      // 混合检索
      const results = await hybridSearchService.search({ query: question, limit: 5 });

      // 构建 Prompt 并调用 LLM
      // TODO: 集成 LLM 调用
      const response = await mockLLMCall(question, results);

      // 添加 AI 消息
      chatService.addMessage('assistant', response.content, response.sources);
      setMessages([...chatService.getMessages()]);

      // 更新配额
      subscriptionManager.updateUsage(response.tokens.output);
    } catch (error) {
      console.error('AI Assistant error:', error);
      chatService.addMessage('assistant', '抱歉，发生了错误。请重试。');
      setMessages([...chatService.getMessages()]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed left-0 top-0 bottom-0 w-96 bg-[#1a1a1a] border-r border-white/10 flex flex-col transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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

// Message Item Component
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
```

**Step 2: 提交**

```bash
git add src/components/AIAssistant.tsx
git commit -m "feat: add AIAssistant component"
```

---

### Task 5: 修改 Sidebar 添加 AI 助手入口

**文件:**
- Modify: `ominiclipper-desktop/src/components/Sidebar.tsx`

**Step 1: 添加 AI 助手按钮**

在侧边栏底部 "Settings" 按钮上方添加：

```tsx
{/* AI Assistant Button */}
<button
  onClick={() => setShowAIAssistant(true)}
  className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
>
  <Icon name="智能助手图标" className="text-[18px]" />
  AI 助手
</button>
```

**Step 2: 传递 isOpen 状态给 AIAssistant**

```tsx
// 在 Sidebar 组件中添加
const [showAIAssistant, setShowAIAssistant] = useState(false);

// 在 return 中
<AIAssistant
  isOpen={showAIAssistant}
  onClose={() => setShowAIAssistant(false)}
/>
```

**Step 3: 提交**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add AI Assistant entry button to Sidebar"
```

---

### Task 6: 集成 LLM 调用

**文件:**
- Modify: `ominiclipper-desktop/src/services/llmProvider.ts`

**Step 1: 添加流式输出支持**

```typescript
// 在 LLMProvider 类中添加
async chat(
  prompt: string,
  options?: { stream?: boolean; onToken?: (token: string) => void }
): Promise<string> {
  // 复用现有实现，添加 stream 支持
}

// 添加新方法
async chatWithContext(
  prompt: string,
  context: string,
  onStream?: (chunk: string) => void
): Promise<string> {
  const fullPrompt = `${SYSTEM_PROMPT}\n\n## 上下文\n${context}\n\n${prompt}`;
  return this.chat(fullPrompt, { stream: true, onToken: onStream });
}
```

**Step 2: 提交**

```bash
git add src/services/llmProvider.ts
git commit -m "feat: add streaming support to LLM provider"
```

---

## 验证清单

- [ ] TypeScript 检查通过
- [ ] npm run dev 正常启动
- [ ] AIAssistant 组件正确显示
- [ ] 发送消息后显示用户消息
- [ ] 模拟 LLM 返回结果
- [ ] 来源编号显示正确
- [ ] 侧边栏 AI 助手入口可点击
- [ ] 面板展开/收起正常

---

*计划版本: v1.0*
*最后更新: 2026-01-20*
