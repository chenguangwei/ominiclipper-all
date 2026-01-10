import React, { useState, useEffect } from 'react';
import { ViewState, AppSettings, SavedItem } from './types';
import { StorageService } from './services/storageService';
import CaptureForm from './components/CaptureForm';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import { PlusCircle, List, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.CAPTURE);
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    // Load initial data
    setSettings(StorageService.getSettings());
    setItems(StorageService.getItems());
  }, []);

  const refreshItems = () => {
    setItems(StorageService.getItems());
  };

  const handleSettingsClose = () => {
    setSettings(StorageService.getSettings());
    setView(ViewState.CAPTURE);
  };

  return (
    // Simulating a popup size: 400px wide, 600px tall
    <div className="w-[400px] h-[600px] bg-white mx-auto shadow-2xl overflow-hidden flex flex-col font-sans text-slate-800 border border-gray-200">
      
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
            O
          </div>
          <h1 className="font-bold text-lg tracking-tight text-gray-900">OmniClipper</h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setView(ViewState.CAPTURE)}
            className={`p-1.5 rounded-md transition-all ${view === ViewState.CAPTURE ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            title="Capture"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView(ViewState.HISTORY)}
            className={`p-1.5 rounded-md transition-all ${view === ViewState.HISTORY ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            title="History"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView(ViewState.SETTINGS)}
            className={`p-1.5 rounded-md transition-all ${view === ViewState.SETTINGS ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {view === ViewState.CAPTURE && (
          <CaptureForm settings={settings} onSaved={refreshItems} />
        )}
        {view === ViewState.HISTORY && (
          <HistoryView items={items} onDelete={refreshItems} />
        )}
        {view === ViewState.SETTINGS && (
          <SettingsView initialSettings={settings} onClose={handleSettingsClose} />
        )}
      </main>
    </div>
  );
};

export default App;