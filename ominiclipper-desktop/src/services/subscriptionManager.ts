/**
 * OmniCollector - Subscription Manager Service
 * 订阅管理 - 处理用户订阅和配额管理
 *
 * 支持云端同步（通过 Supabase profiles 表）
 */

import { UserSubscription, SubscriptionPlan } from '../types/classification';
import llmProviderService, { SUBSCRIPTION_PLANS } from './llmProvider';
import {
  getCurrentUser,
  getUserProfile,
  incrementTokenUsage as cloudIncrementTokenUsage,
  checkQuota as cloudCheckQuota,
  UserProfile,
} from '../supabaseClient';

// 存储键
const STORAGE_KEY_SUBSCRIPTION = 'OMNICLIPPER_SUBSCRIPTION';
const STORAGE_KEY_BILLING_HISTORY = 'OMNICLIPPER_BILLING_HISTORY';

interface BillingHistoryItem {
  id: string;
  date: string;
  amount: number;
  planId: string;
  status: 'completed' | 'refunded' | 'failed';
}

// 云端配额常量
const FREE_TIER_TOKEN_LIMIT = 10_000;
const PRO_TIER_TOKEN_LIMIT = 1_000_000;

class SubscriptionManager {
  private subscription: UserSubscription | null = null;
  private billingHistory: BillingHistoryItem[] = [];

  // Cloud profile cache
  private cloudProfile: UserProfile | null = null;
  private cloudProfileLastFetched: number = 0;
  private readonly CLOUD_CACHE_TTL = 60_000; // 1 minute cache

  constructor() {
    this.loadSubscription();
    this.loadBillingHistory();
  }

  // ============================================
  // Cloud Sync Methods (Supabase Integration)
  // ============================================

  /**
   * 从云端同步用户配置文件
   */
  async syncFromCloud(): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        this.cloudProfile = null;
        return false;
      }

      const profile = await getUserProfile();
      if (profile) {
        this.cloudProfile = profile;
        this.cloudProfileLastFetched = Date.now();

        // 同步订阅状态到本地
        if (profile.is_pro || profile.subscription_tier !== 'free') {
          const planId = profile.subscription_tier === 'team' ? 'team' : 'pro';
          if (!this.subscription || this.subscription.planId !== planId) {
            this.subscription = {
              planId,
              status: 'active',
              startDate: profile.created_at,
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
              monthlyQuota: profile.is_pro ? PRO_TIER_TOKEN_LIMIT : FREE_TIER_TOKEN_LIMIT,
              usedQuota: profile.usage_tokens_this_month,
              tokensUsed: profile.usage_tokens_this_month,
            };
            this.saveSubscription();
          }
        }

        console.log('[SubscriptionManager] Cloud sync successful');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SubscriptionManager] Cloud sync failed:', error);
      return false;
    }
  }

  /**
   * 获取云端配置（带缓存）
   */
  async getCloudProfile(): Promise<UserProfile | null> {
    const now = Date.now();
    if (this.cloudProfile && (now - this.cloudProfileLastFetched) < this.CLOUD_CACHE_TTL) {
      return this.cloudProfile;
    }

    await this.syncFromCloud();
    return this.cloudProfile;
  }

  /**
   * 检查云端配额
   */
  async checkCloudQuota(estimatedTokens: number): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
  }> {
    try {
      return await cloudCheckQuota(estimatedTokens);
    } catch (error) {
      console.error('[SubscriptionManager] Cloud quota check failed:', error);
      // 回退到本地检查
      return {
        allowed: this.canUseAI(),
        remaining: this.getRemainingQuota(),
        limit: this.getQuotaLimit(),
      };
    }
  }

  /**
   * 增加云端 Token 使用量
   */
  async incrementCloudUsage(tokens: number): Promise<boolean> {
    try {
      const result = await cloudIncrementTokenUsage(tokens);
      if (result.success) {
        // 更新本地缓存
        if (this.cloudProfile) {
          this.cloudProfile.usage_tokens_this_month = result.newTotal;
        }
        // 同时更新本地订阅
        this.updateUsage(tokens);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SubscriptionManager] Cloud usage increment failed:', error);
      // 仍然更新本地
      this.updateUsage(tokens);
      return false;
    }
  }

  /**
   * 获取当前是否为 Pro 用户（优先云端）
   */
  async isPro(): Promise<boolean> {
    const profile = await this.getCloudProfile();
    if (profile) {
      return profile.is_pro;
    }
    // 回退到本地
    return this.subscription?.planId === 'pro' || this.subscription?.planId === 'team';
  }

  /**
   * 获取当前订阅层级（优先云端）
   */
  async getSubscriptionTier(): Promise<'free' | 'pro' | 'team'> {
    const profile = await this.getCloudProfile();
    if (profile) {
      return profile.subscription_tier;
    }
    // 回退到本地
    if (this.subscription?.planId === 'team') return 'team';
    if (this.subscription?.planId === 'pro') return 'pro';
    return 'free';
  }

  /**
   * 获取所有订阅计划
   */
  getPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  /**
   * 获取当前订阅
   */
  getSubscription(): UserSubscription | null {
    return this.subscription;
  }

  /**
   * 检查是否有有效订阅
   */
  hasActiveSubscription(): boolean {
    if (!this.subscription) return false;

    const now = new Date();
    const endDate = new Date(this.subscription.endDate);

    return (
      this.subscription.status === 'active' &&
      endDate > now
    );
  }

  /**
   * 检查是否可以使用 AI 功能
   */
  canUseAI(): boolean {
    // 免费用户有基础配额
    if (!this.subscription) {
      return this.getMonthlyUsage() < this.getFreeTierQuota();
    }

    return this.hasActiveSubscription() &&
      this.getMonthlyUsage() < this.subscription.monthlyQuota;
  }

  /**
   * 获取免费版配额
   */
  getFreeTierQuota(): number {
    const plan = this.getPlanById('free');
    return plan?.monthlyQuota || 100000;
  }

  /**
   * 获取月度用量
   */
  getMonthlyUsage(): number {
    const usage = llmProviderService.getCurrentMonthUsage();
    return usage.inputTokens + usage.outputTokens;
  }

  /**
   * 获取剩余配额
   */
  getRemainingQuota(): number {
    if (!this.subscription) {
      return this.getFreeTierQuota() - this.getMonthlyUsage();
    }

    return Math.max(0, this.subscription.monthlyQuota - this.getMonthlyUsage());
  }

  /**
   * 获取使用百分比
   */
  getUsagePercentage(): number {
    const limit = this.subscription
      ? this.subscription.monthlyQuota
      : this.getFreeTierQuota();

    return Math.min(100, (this.getMonthlyUsage() / limit) * 100);
  }

  /**
   * 订阅计划
   */
  async subscribe(planId: string): Promise<{ success: boolean; message: string }> {
    const plan = this.getPlanById(planId);
    if (!plan) {
      return { success: false, message: 'Plan not found' };
    }

    // 在实际应用中，这里会调用支付 API
    // 模拟支付过程
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    this.subscription = {
      planId,
      status: 'active',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      monthlyQuota: plan.monthlyQuota,
      usedQuota: 0,
      tokensUsed: this.getMonthlyUsage()
    };

    this.saveSubscription();

    // 记录账单
    this.addBillingHistoryItem({
      id: `bill-${Date.now()}`,
      date: now.toISOString(),
      amount: plan.price,
      planId,
      status: 'completed'
    });

    return {
      success: true,
      message: `Successfully subscribed to ${plan.name}`
    };
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(): Promise<{ success: boolean; message: string }> {
    if (!this.subscription) {
      return { success: false, message: 'No active subscription' };
    }

    this.subscription.status = 'cancelled';
    this.saveSubscription();

    return {
      success: true,
      message: 'Subscription cancelled. You can still use the service until the end of your billing period.'
    };
  }

  /**
   * 续订订阅
   */
  async renewSubscription(): Promise<{ success: boolean; message: string }> {
    if (!this.subscription) {
      return { success: false, message: 'No subscription to renew' };
    }

    const plan = this.getPlanById(this.subscription.planId);
    if (!plan) {
      return { success: false, message: 'Plan not found' };
    }

    const now = new Date();
    const endDate = new Date(this.subscription.endDate);

    // 如果已过期，从当前日期开始
    if (endDate < now) {
      endDate.setMonth(now.getMonth() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    this.subscription.status = 'active';
    this.subscription.endDate = endDate.toISOString();
    this.saveSubscription();

    return {
      success: true,
      message: `Subscription renewed until ${endDate.toLocaleDateString()}`
    };
  }

  /**
   * 更新用量
   */
  updateUsage(tokens: number): void {
    if (this.subscription) {
      this.subscription.tokensUsed += tokens;
      this.subscription.usedQuota += tokens;
      this.saveSubscription();
    }
  }

  /**
   * 检查是否超出配额
   */
  isOverQuota(): boolean {
    return this.getMonthlyUsage() >= this.getQuotaLimit();
  }

  /**
   * 获取配额限制
   */
  getQuotaLimit(): number {
    if (!this.subscription) {
      return this.getFreeTierQuota();
    }
    return this.subscription.monthlyQuota;
  }

  /**
   * 获取订阅状态信息
   */
  getStatus(): {
    isActive: boolean;
    plan: SubscriptionPlan | null;
    usage: number;
    limit: number;
    remaining: number;
    percentage: number;
    daysUntilReset: number;
  } {
    const plan = this.subscription
      ? this.getPlanById(this.subscription.planId)
      : this.getPlanById('free');

    const now = new Date();
    const endDate = this.subscription
      ? new Date(this.subscription.endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const daysUntilReset = Math.max(0, Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));

    return {
      isActive: this.hasActiveSubscription(),
      plan,
      usage: this.getMonthlyUsage(),
      limit: this.getQuotaLimit(),
      remaining: this.getRemainingQuota(),
      percentage: this.getUsagePercentage(),
      daysUntilReset
    };
  }

  /**
   * 获取账单历史
   */
  getBillingHistory(): BillingHistoryItem[] {
    return [...this.billingHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * 添加账单历史记录
   */
  private addBillingHistoryItem(item: BillingHistoryItem): void {
    this.billingHistory.push(item);
    this.saveBillingHistory();
  }

  /**
   * 根据 ID 获取计划
   */
  private getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(p => p.id === planId);
  }

  /**
   * 加载订阅信息
   */
  private loadSubscription(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SUBSCRIPTION);
      if (stored) {
        this.subscription = JSON.parse(stored);

        // 检查是否过期
        if (this.subscription && new Date(this.subscription.endDate) < new Date()) {
          this.subscription.status = 'expired';
          this.saveSubscription();
        }
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      this.subscription = null;
    }
  }

  /**
   * 保存订阅信息
   */
  private saveSubscription(): void {
    try {
      if (this.subscription) {
        localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(this.subscription));
      } else {
        localStorage.removeItem(STORAGE_KEY_SUBSCRIPTION);
      }
    } catch (error) {
      console.error('Failed to save subscription:', error);
    }
  }

  /**
   * 加载账单历史
   */
  private loadBillingHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BILLING_HISTORY);
      if (stored) {
        this.billingHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load billing history:', error);
      this.billingHistory = [];
    }
  }

  /**
   * 保存账单历史
   */
  private saveBillingHistory(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY_BILLING_HISTORY,
        JSON.stringify(this.billingHistory)
      );
    } catch (error) {
      console.error('Failed to save billing history:', error);
    }
  }

  /**
   * 导出订阅数据
   */
  exportData(): string {
    const data = {
      subscription: this.subscription,
      billingHistory: this.billingHistory,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    // 清理旧的账单历史（保留1年）
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    this.billingHistory = this.billingHistory.filter(
      item => new Date(item.date) >= oneYearAgo
    );
    this.saveBillingHistory();
  }
}

// 导出单例
export const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
