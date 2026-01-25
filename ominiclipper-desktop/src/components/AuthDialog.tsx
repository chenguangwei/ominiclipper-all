import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import {
  isSupabaseConfigured,
  signInWithEmail,
  signUpWithEmail,
  getUserProfile,
  UserProfile,
} from '../supabaseClient';
import { APP_THEMES } from '../constants';
import { ColorMode } from '../types';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
  currentThemeId: string;
  onThemeChange: (id: string) => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  user: any;
  onLogout: () => void;
}

type SettingsTab = 'account' | 'appearance';

const COLOR_MODES: { id: ColorMode; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: 'light_mode' },
  { id: 'dark', label: 'Dark', icon: 'dark_mode' },
  { id: 'system', label: 'System', icon: 'settings_suggest' },
];

const AuthDialog: React.FC<AuthDialogProps> = ({
    isOpen,
    onClose,
    onLoginSuccess,
    currentThemeId,
    onThemeChange,
    colorMode,
    onColorModeChange,
    user,
    onLogout
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // User profile state for quota display
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
     if (isOpen) {
         setActiveTab('account');
         // Load user profile if logged in
         if (user) {
           getUserProfile().then(setProfile);
         }
     }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAuth = async () => {
      setAuthError(null);
      setLoading(true);

      if (!isSupabaseConfigured()) {
          setAuthError("Cloud features not configured. Please contact support or check environment variables.");
          setLoading(false);
          return;
      }

      try {
          if (authMode === 'login') {
            const { user: authUser, error } = await signInWithEmail(email, password);
            if (error) throw new Error(error);
            if (authUser) {
              onLoginSuccess(authUser);
              onClose();
            }
          } else {
            const { user: authUser, error, needsConfirmation } = await signUpWithEmail(email, password);
            if (error) throw new Error(error);
            if (needsConfirmation) {
              setAuthError("Check your email for the confirmation link.");
            } else if (authUser) {
              onLoginSuccess(authUser);
            }
          }
      } catch (e: any) {
          setAuthError(e.message || "Authentication failed");
      } finally {
          setLoading(false);
      }
  };

  const renderContent = () => {
      switch (activeTab) {
          case 'appearance':
              return (
                  <div className="space-y-6">
                      {/* Color Mode Selector */}
                      <div>
                          <h3 className="text-sm font-medium text-content mb-3">Color Mode</h3>
                          <div className="grid grid-cols-3 gap-2">
                              {COLOR_MODES.map(mode => (
                                  <button
                                      key={mode.id}
                                      onClick={() => onColorModeChange(mode.id)}
                                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                                          colorMode === mode.id
                                              ? 'bg-primary/20 border-primary ring-1 ring-primary'
                                              : 'bg-surface-tertiary border-transparent hover:bg-surface-secondary'
                                      }`}
                                  >
                                      <Icon name={mode.icon} className="text-[24px] text-content" />
                                      <span className="text-xs text-content-secondary">{mode.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Accent Color */}
                      <div>
                          <h3 className="text-sm font-medium text-content mb-3">Accent Color</h3>
                          <div className="grid grid-cols-3 gap-3">
                              {APP_THEMES.map(theme => (
                                  <button
                                      key={theme.id}
                                      onClick={() => onThemeChange(theme.id)}
                                      className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${currentThemeId === theme.id ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-surface-tertiary border-transparent hover:bg-surface-secondary'}`}
                                  >
                                      <div
                                        className="w-6 h-6 rounded-full shadow-sm"
                                        style={{ backgroundColor: theme.hex }}
                                      ></div>
                                      <span className="text-xs text-content-secondary">{theme.name}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Preview */}
                      <div className="p-4 bg-surface-tertiary rounded-lg border border-[rgb(var(--color-border)/var(--border-opacity))]">
                          <p className="text-xs text-content-secondary">
                              Preview:
                              <span className="text-primary font-medium ml-1">The quick brown fox jumps over the lazy dog.</span>
                          </p>
                          <button className="mt-3 px-3 py-1.5 bg-primary text-white text-xs rounded shadow-sm">
                              Primary Button
                          </button>
                      </div>
                  </div>
              );
          case 'account':
          default:
              if (user) {
                  // Calculate quota info from profile
                  const isPro = profile?.is_pro ?? false;
                  const tier = profile?.subscription_tier ?? 'free';
                  const usedTokens = profile?.usage_tokens_this_month ?? 0;
                  const tokenLimit = isPro ? 1_000_000 : 10_000;
                  const usagePercent = Math.min(100, (usedTokens / tokenLimit) * 100);

                  const formatTokens = (n: number) => {
                    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
                    return n.toString();
                  };

                  return (
                      <div className="text-center py-8">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-purple-500 mx-auto flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-xl">
                              {user.email?.charAt(0).toUpperCase()}
                          </div>
                          <h3 className="text-lg font-medium text-content">{user.email}</h3>
                          <div className={`flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wide mt-1 mb-6 ${isPro ? 'text-primary' : 'text-slate-400'}`}>
                              <Icon name={isPro ? 'verified' : 'account_circle'} className="text-[14px]" />
                              {tier === 'team' ? 'Team Member' : isPro ? 'Pro Member' : 'Free Plan'}
                          </div>

                          <div className="bg-surface-tertiary rounded-lg p-4 text-left mb-6">
                              <div className="flex justify-between text-xs mb-2">
                                  <span className="text-content-secondary">AI Tokens Used (This Month)</span>
                                  <span className="text-content">{formatTokens(usedTokens)} / {formatTokens(tokenLimit)}</span>
                              </div>
                              <div className="w-full bg-black/20 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-primary'}`}
                                    style={{ width: `${usagePercent}%` }}
                                  ></div>
                              </div>
                              {!isPro && usagePercent > 70 && (
                                <p className="text-xs text-yellow-500 mt-2">
                                  Running low on tokens. Upgrade to Pro for 100x more!
                                </p>
                              )}
                          </div>

                          {!isPro && (
                            <button
                              className="w-full bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 text-white py-2 rounded-md text-sm font-medium mb-3 transition-opacity"
                            >
                              Upgrade to Pro
                            </button>
                          )}

                          <button
                            onClick={onLogout}
                            className="w-full border border-[rgb(var(--color-border)/var(--border-opacity))] hover:bg-surface-secondary text-content-secondary py-2 rounded-md text-sm transition-colors"
                          >
                              Sign Out
                          </button>
                      </div>
                  );
              }
              return (
                   <div className="space-y-4">
                        {authError && (
                            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                                {authError}
                            </div>
                        )}
                        <p className={sectionDescClass}>Sign in to sync your library across devices.</p>
                        <div>
                            <label className={labelClass}>Email</label>
                            <input
                                type="email"
                                className={inputClass}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Password</label>
                            <input
                                type="password"
                                className={inputClass}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleAuth}
                            disabled={loading}
                            className={submitBtnClass}
                        >
                            {loading && <Icon name="progress_activity" className="animate-spin text-[16px]" />}
                            {authMode === 'login' ? 'Sign In' : 'Create Pro Account'}
                        </button>

                        <div className="flex justify-center pt-2">
                            <button
                                onClick={() => {
                                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                    setAuthError(null);
                                }}
                                className={linkClass}
                            >
                                {authMode === 'login' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
                            </button>
                        </div>
                    </div>
              );
      }
  };

  const isLight = colorMode === 'light';

  // Light mode classes
  const dialogClass = isLight
    ? 'w-[600px] h-[450px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex'
    : 'w-[600px] h-[450px] bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex';

  const sidebarClass = isLight
    ? 'w-48 bg-gray-50 border-r border-gray-100 flex flex-col p-2 gap-1'
    : 'w-48 bg-[#181818] border-r border-white/5 flex flex-col p-2 gap-1';

  const sidebarTitleClass = isLight ? 'text-sm font-bold text-gray-700' : 'text-sm font-bold text-slate-200';

  const sidebarItemClass = (tab: string) => isLight
    ? `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`
    : `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`;

  const headerClass = isLight
    ? 'h-12 border-b border-gray-100 flex items-center justify-between px-6 bg-white'
    : 'h-12 border-b border-white/5 flex items-center justify-between px-6 bg-[#252525]';

  const headerTitleClass = isLight ? 'text-sm font-medium text-gray-900 capitalize' : 'text-sm font-medium text-white capitalize';

  const closeBtnClass = isLight ? 'text-gray-400 hover:text-gray-600' : 'text-slate-500 hover:text-white';

  const inputClass = isLight
    ? 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
    : 'w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-primary outline-none';

  const labelClass = isLight ? 'block text-[10px] uppercase text-gray-500 font-bold mb-1' : 'block text-[10px] uppercase text-slate-500 font-bold mb-1';

  const submitBtnClass = isLight
    ? 'w-full bg-[#007aff] hover:bg-[#0066d6] text-white py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2'
    : 'w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2';

  const linkClass = isLight ? 'text-xs text-blue-500 hover:underline' : 'text-xs text-primary hover:underline';

  const sectionDescClass = isLight ? 'text-xs text-gray-400' : 'text-xs text-slate-400';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={dialogClass}>
        
        {/* Sidebar */}
        <div className={sidebarClass}>
             <div className="h-10 flex items-center px-2 mb-2">
                 <h2 className={sidebarTitleClass}>Settings</h2>
             </div>

             <button
                onClick={() => setActiveTab('account')}
                className={sidebarItemClass('account')}
             >
                 <Icon name="account_circle" className="text-[18px]" />
                 Account
             </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={sidebarItemClass('appearance')}
             >
                 <Icon name="palette" className="text-[18px]" />
                 Appearance
             </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
            <div className={headerClass}>
                 <h3 className={headerTitleClass}>{activeTab}</h3>
                 <button onClick={onClose} className={closeBtnClass}>
                    <Icon name="close" />
                 </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {renderContent()}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuthDialog;