
import React, { useMemo, useState } from 'react';
import { DailySummary } from '../types';
import { Sparkles, CalendarDays, Edit3, Trash2, Check, X, RotateCw, FolderOpen, Filter } from 'lucide-react';

interface DailyReviewProps {
  summaries: DailySummary[];
  onUpdateSummary: (date: string, content: string) => void;
  onDeleteSummary: (date: string) => void;
  onGenerateSummary: (date: string) => void; // Trigger AI
  isGenerating: boolean;
}

export const DailyReview: React.FC<DailyReviewProps> = ({ summaries, onUpdateSummary, onDeleteSummary, onGenerateSummary, isGenerating }) => {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Archive Filter State
  const [activeMonth, setActiveMonth] = useState<string>('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const todaySummary = summaries.find(s => s.date === today);

  // 1. Sort all by date desc
  const sortedSummaries = useMemo(() => {
     return [...summaries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [summaries]);

  // 2. Compute Available Months for Menu
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    summaries.forEach(s => {
        if (s.date === today) return; // Skip today in archive menu
        const date = new Date(s.date);
        months.add(`${date.getFullYear()}年${date.getMonth() + 1}月`);
    });
    return Array.from(months).sort((a, b) => {
        const parse = (s: string) => {
            const [y, m] = s.split('年');
            return new Date(parseInt(y), parseInt(m.replace('月','')) - 1).getTime();
        };
        return parse(b) - parse(a);
    });
  }, [summaries, today]);

  // 3. Filter based on active selection
  const filteredSummaries = useMemo(() => {
      return sortedSummaries.filter(s => {
          if (activeMonth === 'all') return true;
          const date = new Date(s.date);
          const key = `${date.getFullYear()}年${date.getMonth() + 1}月`;
          return key === activeMonth;
      });
  }, [sortedSummaries, activeMonth]);

  // 4. Group by month for Archive view (Display logic)
  const grouped = useMemo(() => {
      const g: Record<string, DailySummary[]> = {};
      filteredSummaries.forEach(s => {
          const key = s.date.slice(0, 7); // YYYY-MM
          if (!g[key]) g[key] = [];
          g[key].push(s);
      });
      // Sort keys descending (Newest month first)
      return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSummaries]);

  const startEditing = (summary: DailySummary) => {
      setEditingDate(summary.date);
      setEditContent(summary.content);
  };

  const saveEditing = () => {
      if (editingDate) {
          onUpdateSummary(editingDate, editContent);
          setEditingDate(null);
      }
  };

  const cancelEditing = () => {
      setEditingDate(null);
      setEditContent('');
  };

  const deleteItem = (date: string) => {
      if (window.confirm("确定删除这条总结吗？")) {
          onDeleteSummary(date);
      }
  };

  return (
    <div className="h-full flex flex-col bg-texture relative overflow-hidden">
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
            <header className="mb-8 flex-shrink-0">
                <h2 className="text-3xl font-display font-bold text-notion-text">每日回顾</h2>
                <p className="text-notion-dim mt-2">记录每一天的成长与感悟。</p>
            </header>

            {/* Today's Section */}
            <section className="bg-white rounded-3xl p-8 border border-notion-border shadow-soft mb-12 relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Sparkles size={120} className="text-notion-accentText" />
                </div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                    <h3 className="text-xl font-bold text-notion-text">今天, {today}</h3>
                    <span className="text-sm text-notion-dim">Daily Summary</span>
                    </div>
                    <div className="flex gap-2">
                    {todaySummary?.content && (
                        <button
                            onClick={() => deleteItem(today)}
                            className="p-2.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="删除今日小结"
                        >
                            <Trash2 size={18}/>
                        </button>
                    )}
                    <button 
                        onClick={() => onGenerateSummary(today)}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-5 py-2.5 bg-notion-accent text-notion-accentText rounded-xl font-bold hover:bg-pink-100 transition-colors disabled:opacity-50"
                        >
                        {todaySummary?.content ? (
                            <><RotateCw size={18} className={isGenerating ? "animate-spin" : ""} /> 重新生成</>
                        ) : (
                            <><Sparkles size={18} className={isGenerating ? "animate-spin" : ""} /> AI 生成小结</>
                        )}
                    </button>
                    </div>
                </div>

                <textarea 
                className="w-full h-48 bg-notion-sidebar/50 rounded-xl p-4 border-none outline-none resize-none text-notion-text leading-relaxed shadow-inner focus:ring-2 focus:ring-notion-accent/50 transition-all"
                placeholder="今天发生了什么？点击右上方按钮让 AI 帮你总结..."
                value={todaySummary?.content || ''}
                onChange={(e) => onUpdateSummary(today, e.target.value)}
                />
            </section>

            {/* Archive - Grouped by Month */}
            <div className="space-y-8 pb-24">
                {grouped.map(([month, items]) => {
                    // Filter out today from archive view again to be safe
                    const archiveItems = items.filter(i => i.date !== today);
                    if (archiveItems.length === 0) return null;

                    return (
                        <div key={month}>
                            <h4 className="flex items-center gap-2 text-notion-dim font-bold uppercase tracking-widest mb-4 text-sm sticky top-0 bg-texture/90 backdrop-blur-sm py-2 z-10">
                                <CalendarDays size={16} /> {month}
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                                {archiveItems.map(summary => (
                                    <div key={summary.date} className="bg-white p-6 rounded-2xl border border-notion-border hover:shadow-soft transition-all group relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="text-xs font-bold text-notion-accentText">{summary.date}</div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {editingDate === summary.date ? (
                                                    <>
                                                        <button onClick={saveEditing} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check size={16}/></button>
                                                        <button onClick={cancelEditing} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => startEditing(summary)} className="p-1.5 text-notion-dim hover:bg-notion-hover rounded-lg"><Edit3 size={16}/></button>
                                                        <button onClick={() => deleteItem(summary.date)} className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {editingDate === summary.date ? (
                                            <textarea 
                                                className="w-full min-h-[100px] bg-notion-sidebar p-3 rounded-xl border border-notion-border outline-none resize-none text-sm text-notion-text focus:ring-2 focus:ring-notion-accent/50"
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="text-sm text-notion-text whitespace-pre-wrap leading-relaxed">
                                                {summary.content}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                
                {grouped.length === 0 && (
                    <div className="text-center text-notion-dim py-10 opacity-60">
                        没有历史回顾数据。
                    </div>
                )}
            </div>
        </div>

        {/* Bottom Floating Action Bar (Archive Menu) - Fixed relative to Viewport/Parent */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md px-1.5 py-1.5 rounded-full border border-notion-border shadow-float flex gap-2 pointer-events-auto">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all min-w-[120px] ${isMenuOpen ? 'bg-notion-accent text-notion-accentText' : 'bg-transparent text-notion-text hover:bg-notion-hover'}`}
              >
                <FolderOpen size={18} />
                {activeMonth === 'all' ? '全部归档' : activeMonth}
              </button>
          </div>
        </div>

        {/* Popover Navigation Menu */}
        {isMenuOpen && (
          <div 
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-64 bg-white rounded-2xl shadow-float border border-notion-border p-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="max-h-[50vh] overflow-y-auto">
                <div className="px-3 py-2 text-xs font-bold text-notion-dim uppercase tracking-wider">回顾归档</div>
                <button
                    onClick={() => { setActiveMonth('all'); setIsMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors mb-1 flex justify-between items-center ${activeMonth === 'all' ? 'bg-notion-sidebar text-notion-accentText' : 'text-notion-text hover:bg-notion-hover'}`}
                >
                    全部历史
                    {activeMonth === 'all' && <Filter size={14}/>}
                </button>
                {availableMonths.map(m => (
                    <button
                        key={m}
                        onClick={() => { setActiveMonth(m); setIsMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors mb-1 ${activeMonth === m ? 'bg-notion-accent text-notion-accentText font-bold' : 'text-notion-dim hover:bg-notion-hover hover:text-notion-text'}`}
                    >
                        {m}
                    </button>
                ))}
             </div>
          </div>
        )}
      
        {/* Overlay to close menu */}
        {isMenuOpen && (
            <div className="absolute inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
        )}

    </div>
  );
};
