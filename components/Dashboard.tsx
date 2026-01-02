
import React, { useState } from 'react';
import { AppState } from '../types';
import { CheckCircle2, Circle, Sparkles, ArrowRight, Plus, X, RefreshCw } from 'lucide-react';

interface DashboardProps {
  state: AppState;
  onToggleTask: (id: string) => void;
  onAddTask: (title: string, date: string) => void;
  onGenerateSummary: () => void;
  quoteStr: string;
  onRefreshQuote: () => Promise<void>;
  goToDailyReview: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ state, onToggleTask, onAddTask, onGenerateSummary, quoteStr, onRefreshQuote, goToDailyReview }) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const todayTasks = state.tasks.filter(t => t.date === today);
  const todaySummary = state.summaries.find(s => s.date === today);

  const pending = todayTasks.filter(t => !t.completed);
  const completed = todayTasks.filter(t => t.completed);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return "夜深了。";
    if (hour < 11) return "早安。";
    if (hour < 13) return "中午好。";
    if (hour < 18) return "下午好。";
    return "晚上好。";
  };

  const handleQuickAdd = () => {
    if (!newTaskTitle.trim()) {
        setIsAddingTask(false);
        return;
    }
    onAddTask(newTaskTitle, today);
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const refreshQuote = async () => {
      setIsQuoteLoading(true);
      try {
          await onRefreshQuote();
      } finally {
          setIsQuoteLoading(false);
      }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto bg-texture">
      <header className="mb-10 mt-4">
        <h1 className="text-5xl font-display font-bold text-notion-text mb-3 tracking-tight">{getGreeting()}</h1>
        <div className="flex items-center gap-2 group min-h-[28px]">
            <p className={`text-notion-dim text-lg transition-opacity duration-300 ${isQuoteLoading ? 'opacity-50' : 'opacity-100'}`}>
                {quoteStr}
            </p>
            <button 
                onClick={refreshQuote}
                disabled={isQuoteLoading}
                className="p-1.5 rounded-full text-notion-dim/50 hover:bg-notion-hover hover:text-notion-text transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                title="刷新语录"
            >
                <RefreshCw size={14} className={isQuoteLoading ? 'animate-spin' : ''} />
            </button>
        </div>
      </header>

      {/* Grid Layout Adjustment: lg:grid-cols-12 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Today's Tasks - Takes up 7/12 columns */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-notion-border p-8 shadow-soft relative group">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-xl font-bold text-notion-text">今日计划</h3>
             <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-3 py-1 bg-notion-sidebar rounded-full text-notion-dim">
                    {completed.length}/{todayTasks.length} 完成
                </span>
                <button 
                  onClick={() => setIsAddingTask(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-notion-accent text-notion-accentText hover:bg-notion-accentBorder transition-colors"
                  title="快速添加任务"
                >
                    <Plus size={18} />
                </button>
             </div>
          </div>
          
          <div className="space-y-3">
            {/* Quick Add Input */}
            {isAddingTask && (
                <div className="flex items-center gap-3 p-3 bg-notion-sidebar/50 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <Circle size={22} className="text-notion-dim" />
                    <input 
                        autoFocus
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                        onBlur={handleQuickAdd}
                        placeholder="输入任务，回车保存..."
                        className="flex-1 bg-transparent border-none outline-none text-base text-notion-text placeholder:text-notion-dim"
                    />
                </div>
            )}

            {todayTasks.length === 0 && !isAddingTask && (
              <div 
                onClick={() => setIsAddingTask(true)}
                className="py-12 text-center text-notion-dim italic border border-dashed border-notion-border rounded-2xl cursor-pointer hover:bg-notion-sidebar/50 transition-colors"
              >
                  点击右上角 + 或此处添加任务
              </div>
            )}

            {/* Task List */}
            {todayTasks.map(task => (
              <div 
                key={task.id} 
                onClick={() => onToggleTask(task.id)}
                className="flex items-center gap-4 p-3 hover:bg-notion-hover rounded-xl cursor-pointer group transition-colors"
              >
                {task.completed ? (
                  <CheckCircle2 size={22} className="text-notion-dim shrink-0" />
                ) : (
                  <Circle size={22} className="text-notion-border group-hover:text-notion-accentText shrink-0 transition-colors" />
                )}
                <span className={`text-base transition-all ${task.completed ? 'text-notion-dim line-through decoration-notion-border' : 'text-notion-text font-medium'}`}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Daily Summary Card - Takes up 5/12 columns */}
        <section className="lg:col-span-5 bg-gradient-to-br from-white to-notion-accent/30 rounded-3xl border border-notion-border p-8 shadow-soft flex flex-col relative overflow-hidden group h-fit min-h-[300px]">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                <Sparkles size={100} />
           </div>

          <div className="flex justify-between items-center mb-6 relative z-10">
              <h3 className="text-xl font-bold text-notion-text">每日小结</h3>
              {!todaySummary?.content && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onGenerateSummary(); }}
                    className="flex items-center gap-1 text-xs font-bold text-notion-accentText bg-white px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all"
                  >
                      <Sparkles size={12} /> 一键生成
                  </button>
              )}
          </div>

          <div 
            onClick={goToDailyReview}
            className="flex-1 p-6 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 text-sm text-notion-text leading-loose whitespace-pre-wrap cursor-pointer hover:bg-white/80 transition-colors"
          >
            {todaySummary?.content || (
                <span className="text-notion-dim flex flex-col items-center justify-center h-full gap-2 py-8">
                    还没有今天的总结。
                    <span className="text-xs opacity-70">点击此处前往回顾页面</span>
                </span>
            )}
          </div>
          
          <button onClick={goToDailyReview} className="mt-4 text-xs font-bold text-notion-dim hover:text-notion-text flex items-center gap-1 self-end transition-colors">
              查看历史 <ArrowRight size={12}/>
          </button>
        </section>

      </div>
    </div>
  );
};
