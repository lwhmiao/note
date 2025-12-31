
import React, { useMemo, useState } from 'react';
import { DailySummary } from '../types';
import { Sparkles, CalendarDays, Edit3, Trash2, Check, X, RotateCw } from 'lucide-react';

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

  // Sort by date desc
  const sortedSummaries = useMemo(() => {
     return [...summaries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [summaries]);

  // Group by month for Archive view
  const grouped = useMemo(() => {
      const g: Record<string, DailySummary[]> = {};
      sortedSummaries.forEach(s => {
          const key = s.date.slice(0, 7); // YYYY-MM
          if (!g[key]) g[key] = [];
          g[key].push(s);
      });
      return g;
  }, [sortedSummaries]);

  const today = new Date().toISOString().split('T')[0];
  const todaySummary = summaries.find(s => s.date === today);

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
    <div className="h-full flex flex-col bg-texture p-8 overflow-y-auto">
        <header className="mb-8">
            <h2 className="text-3xl font-display font-bold text-notion-text">每日回顾</h2>
            <p className="text-notion-dim mt-2">记录每一天的成长与感悟。</p>
        </header>

        {/* Today's Section */}
        <section className="bg-white rounded-3xl p-8 border border-notion-border shadow-soft mb-12 relative overflow-hidden">
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
               className="w-full min-h-[150px] bg-notion-sidebar/50 rounded-xl p-4 border-none outline-none resize-none text-notion-text leading-relaxed shadow-inner focus:ring-2 focus:ring-notion-accent/50 transition-all"
               placeholder="今天发生了什么？点击右上方按钮让 AI 帮你总结..."
               value={todaySummary?.content || ''}
               onChange={(e) => onUpdateSummary(today, e.target.value)}
            />
        </section>

        {/* Archive */}
        <div className="space-y-8 pb-12">
            {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                    <h4 className="flex items-center gap-2 text-notion-dim font-bold uppercase tracking-widest mb-4 text-sm">
                        <CalendarDays size={16} /> {month}
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                        {(items as DailySummary[]).map(summary => (
                            summary.date !== today && (
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
                            )
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
