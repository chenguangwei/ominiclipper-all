import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { getClient, saveSupabaseConfig, getSupabaseConfig, resetClient } from '../supabaseClient';
import { APP_THEMES } from '../constants';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
  currentThemeId: string;
  onThemeChange: (id: string) => void;
  user: any;
  onLogout: () => void;
}

type SettingsTab = 'account' | 'appearance' | 'connection';

const AuthDialog: React.FC<AuthDialogProps> = ({ 
    isOpen, 
    onClose, 
    onLoginSuccess, 
    currentThemeId, 
    onThemeChange, 
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

  // Connection State
  const [config, setConfig] = useState(getSupabaseConfig());

  useEffect(() => {
     if (isOpen) {
         // Default to account unless config is missing
         const { url, key } = getSupabaseConfig();
         if (!url || !key) {
             setActiveTab('connection');
         } else {
             setActiveTab('account');
         }
     }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfigSave = () => {
      saveSupabaseConfig(config.url, config.key);
      resetClient();
      setActiveTab('account');
  };

  const handleAuth = async () => {
      setAuthError(null);
      setLoading(true);
      const supabase = getClient();
      
      if (!supabase) {
          setAuthError("Configuration missing. Please check connection settings.");
          setActiveTab('connection');
          setLoading(false);
          return;
      }

      try {
          const { data, error } = authMode === 'login' 
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

          if (error) throw error;
          
          if (data.user) {
              onLoginSuccess(data.user);
              if (authMode === 'login') onClose();
          } else if (authMode === 'signup') {
              setAuthError("Check your email for the confirmation link.");
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
                      <div>
                          <h3 className="text-sm font-medium text-white mb-3">Accent Color</h3>
                          <div className="grid grid-cols-3 gap-3">
                              {APP_THEMES.map(theme => (
                                  <button 
                                      key={theme.id}
                                      onClick={() => onThemeChange(theme.id)}
                                      className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${currentThemeId === theme.id ? 'bg-white/10 border-primary ring-1 ring-primary' : 'bg-black/20 border-transparent hover:bg-white/5'}`}
                                  >
                                      <div 
                                        className="w-6 h-6 rounded-full shadow-sm"
                                        style={{ backgroundColor: theme.hex }}
                                      ></div>
                                      <span className="text-xs text-slate-300">{theme.name}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                          <p className="text-xs text-slate-400">
                              Preview: 
                              <span className="text-primary font-medium ml-1">The quick brown fox jumps over the lazy dog.</span>
                          </p>
                          <button className="mt-3 px-3 py-1.5 bg-primary text-white text-xs rounded shadow-sm">
                              Primary Button
                          </button>
                      </div>
                  </div>
              );
          case 'connection':
              return (
                  <div className="space-y-4">
                        <p className="text-xs text-slate-400">Enter your Supabase project details to enable Pro cloud features.</p>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Project URL</label>
                            <input 
                                type="text" 
                                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-primary outline-none"
                                placeholder="https://xyz.supabase.co"
                                value={config.url}
                                onChange={e => setConfig({...config, url: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Anon Key</label>
                            <input 
                                type="password" 
                                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-primary outline-none"
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                                value={config.key}
                                onChange={e => setConfig({...config, key: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={handleConfigSave}
                            className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-md text-sm font-medium mt-2"
                        >
                            Save Settings
                        </button>
                    </div>
              );
          case 'account':
          default:
              if (user) {
                  return (
                      <div className="text-center py-8">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-purple-500 mx-auto flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-xl">
                              {user.email?.charAt(0).toUpperCase()}
                          </div>
                          <h3 className="text-lg font-medium text-white">{user.email}</h3>
                          <div className="flex items-center justify-center gap-1 text-primary text-xs font-bold uppercase tracking-wide mt-1 mb-6">
                              <Icon name="verified" className="text-[14px]" />
                              Pro Member
                          </div>
                          
                          <div className="bg-white/5 rounded-lg p-4 text-left mb-6">
                              <div className="flex justify-between text-xs mb-2">
                                  <span className="text-slate-400">Storage Used</span>
                                  <span className="text-white">1.2 GB / 10 GB</span>
                              </div>
                              <div className="w-full bg-black/40 rounded-full h-1.5">
                                  <div className="bg-primary h-1.5 rounded-full w-[12%]"></div>
                              </div>
                          </div>

                          <button 
                            onClick={onLogout}
                            className="w-full border border-white/10 hover:bg-white/5 text-slate-300 py-2 rounded-md text-sm transition-colors"
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
                        <p className="text-xs text-slate-400">Sign in to sync your library across devices.</p>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Email</label>
                            <input 
                                type="email" 
                                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-primary outline-none"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Password</label>
                            <input 
                                type="password" 
                                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-primary outline-none"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        
                        <button 
                            onClick={handleAuth}
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
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
                                className="text-xs text-primary hover:underline"
                            >
                                {authMode === 'login' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
                            </button>
                        </div>
                    </div>
              );
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[600px] h-[450px] bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex">
        
        {/* Sidebar */}
        <div className="w-48 bg-[#181818] border-r border-white/5 flex flex-col p-2 gap-1">
             <div className="h-10 flex items-center px-2 mb-2">
                 <h2 className="text-sm font-bold text-slate-200">Settings</h2>
             </div>
             
             <button 
                onClick={() => setActiveTab('account')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 'account' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
             >
                 <Icon name="account_circle" className="text-[18px]" />
                 Account
             </button>
              <button 
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 'appearance' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
             >
                 <Icon name="palette" className="text-[18px]" />
                 Appearance
             </button>
             <button 
                onClick={() => setActiveTab('connection')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 'connection' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
             >
                 <Icon name="cloud" className="text-[18px]" />
                 Connection
             </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
            <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-[#252525]">
                 <h3 className="text-sm font-medium text-white capitalize">{activeTab}</h3>
                 <button onClick={onClose} className="text-slate-500 hover:text-white">
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