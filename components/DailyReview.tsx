import React, { useMemo } from 'react';
import { DailySummary } from '../types';
import { Sparkles, CalendarDays } from 'lucide-react';

interface DailyReviewProps {
  summaries: DailySummary[];
  onUpdateSummary: (date: string, content: string) => void;
  onGenerateSummary: (date: string) => void; // Trigger AI
  isGenerating: boolean;
}

export const DailyReview: React.FC<DailyReviewProps> = ({ summaries, onUpdateSummary, onGenerateSummary, isGenerating }) => {
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
                <button 
                  onClick={() => onGenerateSummary(today)}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-notion-accent text-notion-accentText rounded-xl font-bold hover:bg-pink-100 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={18} className={isGenerating ? "animate-spin" : ""} />
                  {isGenerating ? "生成中..." : "AI 生成小结"}
                </button>
            </div>

            <textarea 
               className="w-full min-h-[150px] bg-notion-sidebar/50 rounded-xl p-4 border-none outline-none resize-none text-notion-text leading-relaxed shadow-inner"
               placeholder="今天发生了什么？点击右上方按钮让 AI 帮你总结..."
               value={todaySummary?.content || ''}
               onChange={(e) => onUpdateSummary(today, e.target.value)}
            />
        </section>

        {/* Archive */}
        <div className="space-y-8">
            {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                    <h4 className="flex items-center gap-2 text-notion-dim font-bold uppercase tracking-widest mb-4 text-sm">
                        <CalendarDays size={16} /> {month}
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                        {items.map(summary => (
                            summary.date !== today && (
                                <div key={summary.date} className="bg-white p-6 rounded-2xl border border-notion-border hover:shadow-soft transition-shadow">
                                    <div className="text-xs font-bold text-notion-accentText mb-2">{summary.date}</div>
                                    <p className="text-sm text-notion-text whitespace-pre-wrap leading-relaxed">
                                        {summary.content}
                                    </p>
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