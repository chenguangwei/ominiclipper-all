import React, { useState } from 'react';
import { AppSettings } from '../types';
import { StorageService } from '../services/storageService';
import { SupabaseService } from '../services/supabaseService';
import { Database, HardDrive, Info, CloudLightning, Check, Loader2, Crown, LogOut, User, Github } from 'lucide-react';

interface SettingsViewProps {
  initialSettings: AppSettings;
  onClose: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ initialSettings, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [saved, setSaved] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleSave = () => {
    StorageService.saveSettings(settings);
    setSaved(true);
    setTimeout(() => {
        setSaved(false);
        onClose();
    }, 1000);
  };

  const updateFeishuConfig = (key: keyof AppSettings['feishuConfig'], value: string) => {
    setSettings(prev => ({
      ...prev,
      feishuConfig: {
        ...prev.feishuConfig,
        [key]: value
      }
    }));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsProcessingAuth(true);
    setAuthError('');

    try {
        let sessionData;
        if (authMode === 'signup') {
            const res = await SupabaseService.auth.signUp(settings.supabaseConfig, email, password);
            // Note: If email confirmation is enabled in Supabase, session might be null here.
            // For this UI, we assume auto-confirm or we simulate immediate login after signup
            if (res && res.user && !res.session) {
                 // Registered but needs confirmation, or fallback login
                 // Attempt login immediately (works if email confirm is off)
                 const loginRes = await SupabaseService.auth.signIn(settings.supabaseConfig, email, password);
                 sessionData = loginRes;
            } else if (res) {
                 sessionData = { user: res.user, session: res.session };
            }
        } else {
            sessionData = await SupabaseService.auth.signIn(settings.supabaseConfig, email, password);
        }

        if (sessionData && sessionData.session) {
            setSettings(prev => ({
                ...prev,
                storageMode: 'supabase',
                userSession: {
                    user: {
                        id: sessionData.user.id,
                        email: sessionData.user.email
                    },
                    accessToken: sessionData.session.access_token,
                    expiresAt: Date.now() + (sessionData.session.expires_in * 1000)
                },
                subscription: {
                    plan: 'monthly', // Auto-grant pro on login for this demo
                    isActive: true,
                    expiryDate: Date.now() + (30 * 24 * 60 * 60 * 1000)
                }
            }));
            // Clear passwords
            setPassword('');
        }
    } catch (err: any) {
        setAuthError(err.message || 'Authentication failed');
    } finally {
        setIsProcessingAuth(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setIsProcessingAuth(true);
    setAuthError('');
    
    // In a real WXT extension, we would use:
    // const redirectUrl = chrome.identity.getRedirectURL();
    // const authUrl = SupabaseService.auth.getOAuthUrl(settings.supabaseConfig, provider, redirectUrl);
    // const responseUrl = await browser.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
    // ... parse token from responseUrl ...
    
    console.log(`[Demo] Initiating ${provider} login simulation...`);
    
    // Simulating the OAuth delay and success for this preview
    setTimeout(() => {
        setSettings(prev => ({
            ...prev,
            storageMode: 'supabase',
            userSession: {
                user: {
                    id: `mock-${provider}-user-id`,
                    email: `demo.user@${provider}.com`
                },
                accessToken: `mock-oauth-access-token-${provider}`,
                expiresAt: Date.now() + 3600000
            },
            subscription: {
                plan: 'monthly',
                isActive: true,
                expiryDate: Date.now() + (30 * 24 * 60 * 60 * 1000)
            }
        }));
        setIsProcessingAuth(false);
    }, 1500);
  };

  const handleLogout = () => {
      setSettings(prev => ({
          ...prev,
          storageMode: 'local', // Revert to local
          userSession: undefined,
          subscription: {
              plan: 'free',
              isActive: false
          }
      }));
  };

  // SVG Icon for Google
  const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      <div className="p-5 space-y-6">
        <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500">Configure where your clips are stored.</p>
        </div>

        {/* Storage Mode Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700">Storage Destination</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSettings(s => ({ ...s, storageMode: 'local' }))}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${
                settings.storageMode === 'local'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <HardDrive className="w-5 h-5" />
              <span className="text-[10px] font-medium">Local</span>
            </button>
            <button
              onClick={() => setSettings(s => ({ ...s, storageMode: 'feishu' }))}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${
                settings.storageMode === 'feishu'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <Database className="w-5 h-5" />
              <span className="text-[10px] font-medium">Feishu</span>
            </button>
            <button
              onClick={() => setSettings(s => ({ ...s, storageMode: 'supabase' }))}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden ${
                settings.storageMode === 'supabase'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              {/* Premium Badge */}
              {!settings.subscription.isActive && (
                 <div className="absolute top-0 right-0">
                    <div className="bg-amber-400 text-[8px] font-bold px-1.5 py-0.5 rounded-bl-md text-amber-900">
                        PRO
                    </div>
                 </div>
              )}
              <CloudLightning className="w-5 h-5" />
              <span className="text-[10px] font-medium">云端存储</span>
            </button>
          </div>
        </div>

        {/* Feishu Configuration */}
        {settings.storageMode === 'feishu' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
             <div className="flex items-start gap-2 p-2 bg-blue-50 text-blue-700 rounded text-xs">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Configure your Feishu/Lark Base connection.</p>
             </div>
             
             <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">App ID</label>
                <input 
                  type="text" 
                  value={settings.feishuConfig.appId}
                  onChange={e => updateFeishuConfig('appId', e.target.value)}
                  className="w-full p-2 rounded border border-gray-300 text-sm"
                  placeholder="cli_..."
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">App Secret</label>
                <input 
                  type="password" 
                  value={settings.feishuConfig.appSecret}
                  onChange={e => updateFeishuConfig('appSecret', e.target.value)}
                  className="w-full p-2 rounded border border-gray-300 text-sm"
                  placeholder="••••••••"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Base App Token</label>
                <input 
                  type="text" 
                  value={settings.feishuConfig.appToken}
                  onChange={e => updateFeishuConfig('appToken', e.target.value)}
                  className="w-full p-2 rounded border border-gray-300 text-sm"
                  placeholder="Found in Base URL"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Table ID</label>
                <input 
                  type="text" 
                  value={settings.feishuConfig.tableId}
                  onChange={e => updateFeishuConfig('tableId', e.target.value)}
                  className="w-full p-2 rounded border border-gray-300 text-sm"
                  placeholder="tbl..."
                />
             </div>
          </div>
        )}

        {/* Cloud/Supabase Auth & Status */}
        {settings.storageMode === 'supabase' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
             {!settings.userSession ? (
                // AUTH LOGIN / SIGNUP FORM
                <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white shadow-lg">
                    <div className="text-center mb-5">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-emerald-500 rounded-full text-white mb-2 shadow-lg shadow-emerald-500/20">
                            <CloudLightning className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold">Cloud Storage</h3>
                        <p className="text-slate-400 text-xs mt-1">
                            {authMode === 'signin' ? 'Sign in to access your cloud library' : 'Create a pro account to start syncing'}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-3">
                        <div>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                className="w-full p-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="w-full p-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                required
                                minLength={6}
                            />
                        </div>
                        
                        {authError && (
                            <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/30">
                                {authError}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isProcessingAuth}
                            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center"
                        >
                            {isProcessingAuth && !authError ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                authMode === 'signin' ? 'Sign In' : 'Create Account'
                            )}
                        </button>
                    </form>

                    <div className="mt-4 flex items-center justify-between gap-4 text-xs text-slate-400">
                        <span className="h-px bg-slate-600 flex-1"></span>
                        <span>OR</span>
                        <span className="h-px bg-slate-600 flex-1"></span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button 
                            type="button"
                            onClick={() => handleOAuthLogin('google')}
                            disabled={isProcessingAuth}
                            className="flex items-center justify-center gap-2 py-2 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors"
                        >
                            <GoogleIcon />
                            Google
                        </button>
                        <button 
                            type="button"
                            onClick={() => handleOAuthLogin('github')}
                            disabled={isProcessingAuth}
                            className="flex items-center justify-center gap-2 py-2 bg-[#24292F] text-white rounded-lg text-xs font-semibold hover:bg-[#24292F]/80 transition-colors border border-slate-600"
                        >
                            <Github className="w-4 h-4" />
                            GitHub
                        </button>
                    </div>

                    <div className="mt-4 text-center">
                        <button 
                            type="button"
                            onClick={() => {
                                setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                                setAuthError('');
                            }}
                            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            {authMode === 'signin' 
                                ? "Don't have an account? Create one" 
                                : "Already have an account? Sign In"}
                        </button>
                    </div>
                </div>
             ) : (
                // LOGGED IN STATE
                <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-emerald-900 text-sm truncate">{settings.userSession.user.email}</h4>
                            <p className="text-xs text-emerald-600 flex items-center">
                                <Crown className="w-3 h-3 mr-1 text-amber-500" />
                                Pro Member
                            </p>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="p-2 text-emerald-600/70 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="bg-white/60 p-3 rounded-lg border border-emerald-100/50 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                             <span className="text-emerald-800">Sync Status</span>
                             <span className="flex items-center text-emerald-600 font-medium">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                                Active
                             </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                             <span className="text-emerald-800">Plan Renewal</span>
                             <span className="text-emerald-600">
                                {new Date(settings.subscription.expiryDate || 0).toLocaleDateString()}
                             </span>
                        </div>
                    </div>
                    
                    <div className="text-[10px] text-emerald-600/50 text-center">
                        Securely connected to Supabase Cloud
                    </div>
                </div>
             )}
          </div>
        )}

      </div>

      <div className="mt-auto p-4 border-t border-gray-100 bg-gray-50">
        <button
            onClick={handleSave}
            className="w-full flex items-center justify-center py-2.5 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-70"
        >
            {saved ? "Settings Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default SettingsView;