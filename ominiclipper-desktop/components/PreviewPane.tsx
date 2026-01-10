import React from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';

interface PreviewPaneProps {
  item: ResourceItem | null;
  getTagName: (id: string) => string;
}

const PreviewPane: React.FC<PreviewPaneProps> = ({ item, getTagName }) => {
  if (!item) {
    return (
      <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center text-slate-600 flex-col gap-2 select-none">
        <Icon name="description" className="text-[64px] opacity-20" />
        <span className="text-sm font-medium opacity-50">No item selected</span>
      </div>
    );
  }

  const getBigIcon = () => {
     switch (item.type) {
      case ResourceType.WORD: return <Icon name="description" className="text-[64px] text-word-blue/20" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-[64px] text-pdf-red/20" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-[64px] text-epub-purple/20" />;
      default: return <Icon name="article" className="text-[64px] text-slate-500/20" />;
    }
  };

  const getKindLabel = () => {
       switch (item.type) {
        case ResourceType.WORD: return 'Microsoft Word';
        case ResourceType.PDF: return 'PDF Document';
        case ResourceType.EPUB: return 'EPUB eBook';
        case ResourceType.WEB: return 'Web Page';
        default: return 'Document';
    }
  }

  return (
    <main className="flex-1 flex flex-col bg-[#1a1a1a] relative overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* Header Banner - Reduced Height */}
            <div className="relative w-full h-32 bg-[#252525] flex items-center justify-center select-none overflow-hidden">
                 <div className="absolute inset-0 opacity-10 flex items-center justify-center scale-150 blur-xl">
                      {getBigIcon()}
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent"></div>
            </div>
            
            {/* Content Container - Adjusted margins for compact view */}
            <div className="max-w-3xl mx-auto px-6 -mt-12 relative z-10 pb-20">
                <div className="flex items-start gap-4 mb-4">
                     {/* Icon Box */}
                    <div className="h-20 w-20 rounded-xl bg-[#2a2a2a] border border-white/10 shadow-2xl flex items-center justify-center shrink-0">
                         {item.type === ResourceType.WEB 
                            ? <Icon name="language" className="text-[40px] text-tag-green" />
                            : <Icon name={item.type === ResourceType.WORD ? "description" : "article"} className={`text-[40px] ${item.type === ResourceType.WORD ? "text-word-blue" : item.type === ResourceType.PDF ? "text-pdf-red" : "text-slate-400"}`} />
                         }
                    </div>

                    <div className="pt-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                             <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{getKindLabel()}</span>
                             {item.isCloud && (
                                <Icon name="cloud" className="text-[12px] text-sky-500" />
                             )}
                        </div>
                        <h1 className="text-2xl font-bold text-white leading-tight tracking-tight select-text break-words">{item.title}</h1>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6 ml-[104px]">
                    {item.tags.map(tagId => (
                        <span key={tagId} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors cursor-pointer">
                             {getTagName(tagId)}
                        </span>
                    ))}
                    
                    {item.color && (
                         <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-${item.color}/10 border border-${item.color}/20 text-xs text-${item.color} font-medium`}>
                             <div className={`w-1.5 h-1.5 rounded-full bg-${item.color}`}></div>
                             Label
                         </span>
                    )}
                </div>

                {/* Content Area */}
                <div className="prose prose-invert max-w-none mt-8 border-t border-white/5 pt-8">
                     <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Summary</h3>
                    <div className="p-0 text-base text-slate-300 leading-relaxed font-light">
                        {item.contentSnippet || "No description available."}
                    </div>
                    
                     <div className="grid grid-cols-2 gap-4 mt-8">
                         <div className="p-3 border-l-2 border-white/10 pl-4">
                             <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Created</span>
                             <span className="text-sm text-slate-300">{new Date(item.createdAt).toLocaleString()}</span>
                         </div>
                          <div className="p-3 border-l-2 border-white/10 pl-4">
                             <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Location</span>
                             <span className="text-sm text-slate-300 break-all">{item.path || "Local / Library"}</span>
                         </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-8">
                        <button className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                             <Icon name="open_in_new" />
                             Open
                        </button>
                        <button className="px-4 bg-[#252525] hover:bg-[#303030] text-slate-300 font-medium py-2 rounded-lg transition-colors border border-white/10">
                            <Icon name="share" />
                        </button>
                         <button className="px-4 bg-[#252525] hover:bg-[#303030] text-slate-300 font-medium py-2 rounded-lg transition-colors border border-white/10">
                            <Icon name="more_horiz" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer Breadcrumbs */}
        <footer className="h-8 border-t border-white/5 bg-[#252525]/60 mac-blur px-4 flex items-center shrink-0">
             <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Icon name="folder" className="text-[14px]" />
                <span className="hover:text-slate-300 cursor-pointer">Library</span>
                <Icon name="chevron_right" className="text-[12px] opacity-30" />
                <span className="text-slate-300 truncate max-w-[200px]">{item.title}</span>
            </div>
        </footer>
    </main>
  );
};

export default PreviewPane;