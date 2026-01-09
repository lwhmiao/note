
import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, CheckCircle2 } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onAddTask: (title: string, date: string, tag?: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
}

// Helper to get local YYYY-MM-DD string
const toLocalDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const stringToColorClass = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-green-100 text-green-700 border-green-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-orange-100 text-orange-700 border-orange-200',
      'bg-pink-100 text-pink-700 border-pink-200',
  ];
  return palettes[Math.abs(hash) % 5];
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  currentDate,
  setCurrentDate
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  
  const [formTitle, setFormTitle] = useState('');
  const [formTag, setFormTag] = useState('');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthName = currentDate.toLocaleString('zh-CN', { month: 'long' });
  const year = currentDate.getFullYear();

  const days = useMemo(() => {
    const d = [];
    for (let i = 0; i < firstDayOfMonth; i++) d.push(null);
    for (let i = 1; i <= daysInMonth; i++) d.push(new Date(year, currentDate.getMonth(), i));
    // Fill the last row with nulls to ensure complete grid borders
    while (d.length % 7 !== 0) d.push(null);
    return d;
  }, [currentDate, year, daysInMonth, firstDayOfMonth]);

  // OPTIMIZATION: Memoize task grouping to avoid O(N*M) filtering in render loop
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(t => {
        if (!map[t.date]) map[t.date] = [];
        map[t.date].push(t);
    });
    return map;
  }, [tasks]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, currentDate.getMonth() + offset, 1));
  };

  const openAddModal = (dateStr: string) => {
      setSelectedDateStr(dateStr);
      setEditingTask(null);
      setFormTitle('');
      setFormTag('');
      setModalOpen(true);
  };

  const openEditModal = (task: Task, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingTask(task);
      setFormTitle(task.title);
      setFormTag(task.tag || '');
      setSelectedDateStr(task.date);
      setModalOpen(true);
  };

  const handleSave = () => {
      if (!formTitle.trim()) return;
      if (editingTask) {
          onUpdateTask(editingTask.id, { title: formTitle, tag: formTag });
      } else {
          onAddTask(formTitle, selectedDateStr, formTag);
      }
      setModalOpen(false);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-texture overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-notion-text font-display">{year}年 {monthName}</h2>
        <div className="flex gap-2 bg-white/80 dark:bg-notion-sidebar rounded-xl shadow-sm border border-notion-border p-1 transition-colors">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-notion-hover rounded-lg text-notion-dim"><ChevronLeft size={20} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 text-sm hover:bg-notion-hover rounded-lg text-notion-text font-medium">今天</button>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-notion-hover rounded-lg text-notion-dim"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* Grid Container: Changed to border-based grid to allow transparent cells over texture */}
      <div className="grid grid-cols-7 bg-transparent border-t border-l border-notion-border flex-1 rounded-2xl overflow-y-auto">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => (
          /* Header: Added border-r and border-b for grid lines */
          <div key={day} className="bg-white/80 dark:bg-notion-sidebar p-3 text-xs font-bold text-notion-dim text-center uppercase tracking-wider sticky top-0 z-10 backdrop-blur-none border-r border-b border-notion-border">
            {day}
          </div>
        ))}

        {days.map((date, idx) => {
          // Use border-based grid lines instead of gap to prevent background bleed-through
          const baseCellClass = "bg-white/80 dark:bg-notion-bg min-h-[100px] border-r border-b border-notion-border";
          
          if (!date) return <div key={`pad-${idx}`} className={baseCellClass} />;

          const dateStr = toLocalDateStr(date);
          const todayStr = toLocalDateStr(new Date());
          const isToday = todayStr === dateStr;
          const dayTasks = tasksByDate[dateStr] || [];

          return (
            <div 
                key={dateStr} 
                onClick={() => openAddModal(dateStr)}
                // Fixed bg-white/80 without underlying grey container
                className={`${baseCellClass} p-2 flex flex-col relative cursor-pointer`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-notion-accentText text-white shadow-md' : 'text-notion-text'}`}>
                  {date.getDate()}
                </span>
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[120px] scrollbar-hide">
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={(e) => openEditModal(task, e)}
                    className={`text-xs px-2 py-1.5 rounded-md border-l-4 truncate ${
                      task.completed
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 line-through'
                        : stringToColorClass(task.title)
                    }`}
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-notion-dark/30 backdrop-blur-sm p-4">
              <div className="bg-white/95 dark:bg-notion-bg w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-white/20 transition-colors">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-notion-text">{editingTask ? '编辑任务' : '新任务'}</h3>
                      <button onClick={() => setModalOpen(false)} className="text-notion-dim hover:text-notion-text"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-notion-dim uppercase mb-1 block">内容</label>
                          <input 
                              autoFocus
                              className="w-full p-3 bg-notion-sidebar rounded-xl border-none outline-none focus:ring-2 focus:ring-notion-accentText/20 text-notion-text"
                              value={formTitle}
                              onChange={e => setFormTitle(e.target.value)}
                              placeholder="准备做什么？"
                              onKeyDown={e => e.key === 'Enter' && handleSave()}
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-notion-dim uppercase mb-1 block">标签 (选填)</label>
                          <input 
                              className="w-full p-3 bg-notion-sidebar rounded-xl border-none outline-none text-sm text-notion-text"
                              value={formTag}
                              onChange={e => setFormTag(e.target.value)}
                              placeholder="例如: 工作"
                          />
                      </div>
                      <div className="text-xs text-notion-dim text-right pt-1">
                          {selectedDateStr}
                      </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                      {editingTask && (
                         <>
                             <button onClick={() => { onDeleteTask(editingTask.id); setModalOpen(false); }} className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={20}/></button>
                             <button onClick={() => { onToggleTask(editingTask.id); setModalOpen(false); }} className={`p-3 rounded-xl flex-1 font-bold flex items-center justify-center gap-2 ${editingTask.completed ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>
                                 <CheckCircle2 size={20}/> {editingTask.completed ? '标记未完成' : '完成'}
                             </button>
                         </>
                      )}
                      <button onClick={handleSave} className="flex-1 p-3 bg-notion-accentText text-white dark:text-black rounded-xl font-bold shadow-lg shadow-pink-200 hover:opacity-90">保存</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
