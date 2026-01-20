# Phase 2: 云端智能 - Supabase 集成实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 Supabase 云端集成，使用户能够登录、同步配额、使用 AI 功能

**Architecture:** 基于环境变量配置 Supabase，使用 profiles 表同步用户订阅状态和 Token 配额

**Tech Stack:** Supabase Auth + profiles 表 + 本地缓存

---

## 现状确认

### 已完成 ✅
1. `supabaseClient.ts` - 支持 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 环境变量
2. `subscriptionManager.ts` - 云端同步方法 (`syncFromCloud`, `checkCloudQuota`, `incrementCloudUsage`)
3. `AuthDialog.tsx` - 已显示用户配额 UI
4. `.env.example` - 环境变量模板

### 待完成 ❌
1. 创建 `.env` 文件（从模板复制）
2. 验证环境变量配置正确
3. 验证云端 Token 配额同步功能

---

## 任务清单

### Task 1: 创建 `.env` 文件

**文件:**
- Create: `ominiclipper-desktop/.env`

**Step 1: 复制模板并创建 .env 文件**

```bash
cp ominiclipper-desktop/.env.example ominiclipper-desktop/.env
```

**Step 2: 验证文件已创建**

```bash
ls -la ominiclipper-desktop/.env
```

Expected: `-rw-r--r-- 1 user staff 680 Jan 20 xx:xx ominiclipper-desktop/.env`

---

### Task 2: 验证 Supabase 配置检查逻辑

**文件:**
- Modify: `supabaseClient.ts:14-17`

**Step 1: 添加配置检查日志**

当前 `isSupabaseConfigured` 函数已存在，验证其能正确检测配置：

```typescript
// 当前实现
export const isSupabaseConfigured = (): boolean => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
};
```

验证方式：在 App 启动时检查控制台输出。

**Step 2: 运行应用验证配置检测**

```bash
cd ominiclipper-desktop && npm run dev
```

Expected: 启动日志中应显示 `[Supabase] Client initialized` 或警告信息

---

### Task 3: 验证订阅管理器云端同步

**文件:**
- Modify: `services/subscriptionManager.ts:55-93`

**Step 1: 检查 `syncFromCloud` 方法**

当前实现已包含：
- 获取云端用户配置
- 同步 `is_pro` 和 `subscription_tier` 状态
- 同步 `usage_tokens_this_month` 用量

**Step 2: 验证云端配额检查流程**

```typescript
// 验证 cloudCheckQuota 返回正确的限制
const FREE_LIMIT = 10_000;
const PRO_LIMIT = 1_000_000;
```

---

### Task 4: 验证 UI 配额显示

**文件:**
- Modify: `components/AuthDialog.tsx:163-203`

**Step 1: 检查配额 UI 渲染逻辑**

当前 UI 显示：
- 已用 Token 数
- 配额限制
- 使用百分比进度条
- Pro 用户升级提示

**Step 2: 验证 Token 格式化函数**

```typescript
const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};
```

---

### Task 5: 验证增量 Token 用量

**文件:**
- Modify: `supabaseClient.ts:255-299`

**Step 1: 检查 `incrementTokenUsage` 实现**

当前实现包含：
- RPC 调用 (`increment_token_usage`)
- 回退机制（直接更新）

**Step 2: 验证用量更新后刷新 UI**

登录后调用 `getUserProfile()` 刷新配额显示。

---

## 验证清单

### 功能验证

- [ ] 未配置时显示警告信息
- [ ] 登录后显示用户邮箱
- [ ] 显示正确的订阅层级 (Free/Pro/Team)
- [ ] 显示本月已用 Token
- [ ] 显示配额进度条
- [ ] Free 用户超过 70% 显示警告
- [ ] 非 Pro 用户显示升级按钮
- [ ] 退出登录正常工作

### 技术验证

- [ ] Supabase client 正确初始化
- [ ] 环境变量正确读取
- [ ] 云端配额同步正常工作
- [ ] Token 用量正确累加

---

## 后续步骤

完成 Phase 2 后，可继续 Phase 3: RAG 问答功能。

---

*计划版本: v1.0*
*最后更新: 2026-01-20*
*状态: 大部分已完成，待创建 .env 文件并验证*
