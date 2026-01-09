
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BacklogTask, Quadrant, TaskType } from '../types';
import { Plus, Grid, List, X, Calendar, Edit3, Trash2, ArrowRight, Repeat, CheckCircle2 } from 'lucide-react';

interface PlanBoardProps {
  tasks: BacklogTask[];
  onAddBacklogTask: (title: string, quadrant: Quadrant, type: TaskType) => void;
  onUpdateBacklogTask: (id: string, updates: Partial<BacklogTask>) => void;
  onDeleteBacklogTask: (id: string) => void;
  onScheduleTask: (task: BacklogTask, startDate: string, endDate?: string) => void;
}

// Low Saturation Morandi Colors
// We use custom classes or style injection strategies via Tailwind's arbitrary values for precise control
// Dark mode strategy: Use white/10 or white/5 transparency to blend with dark background, rather than distinct colors.
const MORANDI_COLORS = {
  // Q1: Muted Red/Pink -> Desaturated to almost gray-pink
  [Quadrant.Q1]: { 
      bg: 'bg-[#F0EBEB]/80 dark:bg-white/10', 
      border: 'border-[#E0D5D5] dark:border-white/10', 
      text: 'text-[#524545] dark:text-[#E0E0E0]', 
      badge: 'bg-[#E0D5D5] text-[#524545]' 
  }, 
  // Q2: Muted Blue/Grey
  [Quadrant.Q2]: { 
      bg: 'bg-[#E6F0F2]/80 dark:bg-white/5', 
      border: 'border-[#D0E0E6] dark:border-white/10', 
      text: 'text-[#3A4A5C] dark:text-[#D0D0D0]', 
      badge: 'bg-[#D0E0E6] text-[#3A4A5C]' 
  }, 
  // Q3: Muted Beige/Yellow
  [Quadrant.Q3]: { 
      bg: 'bg-[#F2F0E6]/80 dark:bg-white/5', 
      border: 'border-[#E6E0D0] dark:border-white/10', 
      text: 'text-[#5C553A] dark:text-[#D0D0D0]', 
      badge: 'bg-[#E6E0D0] text-[#5C553A]' 
  }, 
  // Q4: Muted Neutral Gray
  [Quadrant.Q4]: { 
      bg: 'bg-[#F0F0F0]/80 dark:bg-white/[0.02]', 
      border: 'border-[#E0E0E0] dark:border-white/5', 
      text: 'text-[#5C5C5C] dark:text-[#A0A0A0]', 
      badge: 'bg-[#E0E0E0] text-[#5C5C5C]' 
  }, 
};

const QUADRANT_TITLES = {
  [Quadrant.Q1]: '重要且紧急',
  [Quadrant.Q2]: '重要不紧急',
  [Quadrant.Q3]: '不重要但紧急',
  [Quadrant.Q4]: '不重要不紧急'
};

export const PlanBoard: React.FC<PlanBoardProps> = ({ 
  tasks, 
  onAddBacklogTask, 
  onUpdateBacklogTask, 
  onDeleteBacklogTask,
  onScheduleTask 
}) => {
  // Persistence for View Mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
      const saved = localStorage.getItem('lifeos_plan_view_mode');
      return (saved as 'grid' | 'list') || 'list';
  });

  useEffect(() => {
      localStorage.setItem('lifeos_plan_view_mode', viewMode);
  }, [viewMode]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BacklogTask | null>(null);
  
  // Add Form State
  const [newTitle, setNewTitle] = useState('');
  const [newQuadrant, setNewQuadrant] = useState<Quadrant>(Quadrant.Q2);
  const [newType, setNewType] = useState<TaskType>('once');

  // Edit/Schedule State
  const [editTitle, setEditTitle] = useState('');
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');

  // --- Refs for Drop Zones ---
  const quadrantRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // --- Desktop Drag State ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('taskId', id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetQuadrant: Quadrant) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (id) {
        onUpdateBacklogTask(id, { quadrant: targetQuadrant });
    }
  };

  // --- Mobile Touch Drag State ---
  const [mobileDragTask, setMobileDragTask] = useState<BacklogTask | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });

  // 1. Initiate Logic (Long Press)
  const handleTouchStart = (e: React.TouchEvent, task: BacklogTask) => {
    // Only handle single touch
    if (e.touches.length > 1) return;

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    touchStartPos.current = { x: startX, y: startY };
    
    // Clear any existing timer
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
        // Activate Drag Mode
        setMobileDragTask(task);
        setDragPos({ x: startX, y: startY });
        if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
    }, 400); // 400ms long press trigger
  };

  // 2. Cancel Logic (If user scrolls instead of holding)
  const handleTouchMoveCheck = (e: React.TouchEvent) => {
      if (!mobileDragTask && longPressTimer.current) {
          const touch = e.touches[0];
          const diff = Math.hypot(touch.clientX - touchStartPos.current.x, touch.clientY - touchStartPos.current.y);
          // If moved more than 10px, it's a scroll, cancel the timer
          if (diff > 10) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
          }
      }
  };

  const handleTouchEndCheck = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  // 3. Global Drag Handling (Active when mobileDragTask is set)
  useEffect(() => {
    if (!mobileDragTask) return;

    const handleGlobalTouchMove = (e: TouchEvent) => {
        if (e.cancelable) e.preventDefault(); // Stop screen scrolling
        const touch = e.touches[0];
        setDragPos({ x: touch.clientX, y: touch.clientY });
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const x = touch.clientX;
        const y = touch.clientY;
        
        // Detect Drop Zone using BoundingRects
        let targetQuadrant: Quadrant | null = null;
        Object.entries(quadrantRefs.current).forEach(([key, el]) => {
            if (el) {
                const rect = (el as HTMLElement).getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    targetQuadrant = parseInt(key) as Quadrant;
                }
            }
        });

        // Apply Update if valid
        if (targetQuadrant && targetQuadrant !== mobileDragTask.quadrant) {
            onUpdateBacklogTask(mobileDragTask.id, { quadrant: targetQuadrant });
            if (navigator.vibrate) navigator.vibrate([10, 50]); // Success Haptic
        }

        // Reset
        setMobileDragTask(null);
    };

    // Attach to document for smooth tracking even if finger leaves element
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    
    return () => {
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [mobileDragTask, onUpdateBacklogTask]);

  const openAddModal = () => {
      setNewTitle('');
      setNewQuadrant(Quadrant.Q2);
      setNewType('once');
      setIsAddModalOpen(true);
  };

  const openDetailModal = (task: BacklogTask) => {
      if (mobileDragTask) return; // Don't open if just dragging
      setSelectedTask(task);
      setEditTitle(task.title);
      setScheduleStartDate(new Date().toISOString().split('T')[0]);
      setScheduleEndDate('');
  };

  const handleAddSubmit = () => {
      if (!newTitle.trim()) return;
      onAddBacklogTask(newTitle, newQuadrant, newType);
      setIsAddModalOpen(false);
  };

  const handleDetailAction = (action: 'save' | 'delete' | 'schedule') => {
      if (!selectedTask) return;

      if (action === 'delete') {
          if (confirm("确定删除这个计划吗？")) {
              onDeleteBacklogTask(selectedTask.id);
              setSelectedTask(null);
          }
      } else if (action === 'save') {
          if (editTitle.trim()) {
              onUpdateBacklogTask(selectedTask.id, { title: editTitle });
              setSelectedTask(null);
          }
      } else if (action === 'schedule') {
          if (!scheduleStartDate) {
              alert("请选择开始日期");
              return;
          }
          if (selectedTask.type === 'longterm' && !scheduleEndDate) {
              alert("长期任务需要结束日期");
              return;
          }
          if (selectedTask.type === 'longterm' && scheduleEndDate < scheduleStartDate) {
              alert("结束日期不能早于开始日期");
              return;
          }
          
          onScheduleTask(selectedTask, scheduleStartDate, scheduleEndDate);
          setSelectedTask(null); // Close modal
          alert(selectedTask.type === 'once' ? "已移动到日历待办" : "已将日程批量添加到日历");
      }
  };

  // Quadrant Component
  const QuadrantSection = ({ q }: { q: Quadrant }) => {
      const qTasks = tasks.filter(t => t.quadrant === q);
      const style = MORANDI_COLORS[q];

      return (
          <div 
            ref={el => { quadrantRefs.current[q] = el; }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, q)}
            className={`flex flex-col h-full rounded-2xl border ${style.border} ${style.bg} transition-colors p-4 relative overflow-hidden`}
          >
              <h3 className={`font-bold text-sm mb-3 uppercase tracking-wider ${style.text} flex justify-between items-center pointer-events-none`}>
                  {QUADRANT_TITLES[q]}
                  <span className="text-xs opacity-60 bg-white/50 px-2 py-0.5 rounded-full">{qTasks.length}</span>
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                  {qTasks.map(task => {
                      const isBeingDraggedMobile = mobileDragTask?.id === task.id;
                      return (
                        <div
                            key={task.id}
                            draggable // Desktop Drag
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            
                            // Mobile Touch Logic
                            onTouchStart={(e) => handleTouchStart(e, task)}
                            onTouchMove={handleTouchMoveCheck}
                            onTouchEnd={handleTouchEndCheck}
                            
                            onClick={() => openDetailModal(task)}
                            className={`bg-white/80 dark:bg-notion-bg backdrop-blur-sm p-3 rounded-xl border border-white/20 shadow-sm cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-transform group select-none ${isBeingDraggedMobile ? 'opacity-30' : 'opacity-100'}`}
                            onContextMenu={(e) => e.preventDefault()} // Prevent context menu
                        >
                            <div className="flex justify-between items-start gap-2 pointer-events-none">
                                <span className="text-sm text-notion-text font-medium leading-snug">{task.title}</span>
                                {task.type === 'longterm' && (
                                    <Repeat size={12} className="text-notion-accentText mt-1 flex-shrink-0" />
                                )}
                            </div>
                        </div>
                      );
                  })}
                  {qTasks.length === 0 && (
                      <div className="h-full flex items-center justify-center text-xs opacity-30 italic font-medium pointer-events-none text-notion-dim">
                          空空如也
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col bg-texture relative overflow-hidden">
        
        {/* Header & Toggle */}
        <div className="p-6 pb-2 flex justify-between items-end flex-shrink-0">
            <div>
                <h2 className="text-3xl font-display font-bold text-notion-text">计划池</h2>
                <p className="text-notion-dim mt-1 text-sm">种下一棵树最好的时间是十年前，其次是现在。</p>
            </div>
            
            <div className="md:hidden bg-notion-sidebar rounded-lg p-1 border border-notion-border flex">
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-notion-accent text-notion-accentText' : 'text-notion-dim'}`}><List size={18}/></button>
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-notion-accent text-notion-accentText' : 'text-notion-dim'}`}><Grid size={18}/></button>
            </div>
        </div>

        {/* Board Area */}
        <div className="flex-1 p-4 md:p-6 overflow-hidden relative">
             {/* Desktop is always grid, Mobile depends on toggle */}
             <div className={`h-full w-full gap-4 ${viewMode === 'grid' || window.innerWidth >= 768 ? 'grid grid-cols-2 grid-rows-2' : 'flex flex-col space-y-4 overflow-y-auto pb-20'}`}>
                 <QuadrantSection q={Quadrant.Q1} />
                 <QuadrantSection q={Quadrant.Q2} />
                 <QuadrantSection q={Quadrant.Q3} />
                 <QuadrantSection q={Quadrant.Q4} />
             </div>
        </div>
        
        {/* Mobile Drag Ghost - Portal to Body for Fixed Positioning */}
        {mobileDragTask && createPortal(
             <div 
                className="fixed z-[9999] pointer-events-none"
                style={{ 
                    left: dragPos.x, 
                    top: dragPos.y,
                    transform: 'translate(-50%, -50%)', // Center on finger
                    touchAction: 'none'
                }}
             >
                <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border-2 border-notion-accentText shadow-2xl w-40 animate-in zoom-in-95 duration-100 flex flex-col items-center text-center">
                   <div className="text-sm font-bold text-notion-text line-clamp-2">{mobileDragTask.title}</div>
                   <div className="text-[10px] text-notion-accentText mt-1 flex items-center gap-1 font-bold">
                       <CheckCircle2 size={12} /> 松手移动
                   </div>
                </div>
             </div>,
             document.body
        )}

        {/* Floating Add Button */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <button 
                onClick={openAddModal}
                className="flex items-center gap-2 px-8 py-3 bg-notion-accentText text-white dark:text-black rounded-full shadow-lg shadow-pink-200/50 hover:scale-105 transition-transform font-bold"
            >
                <Plus size={20} /> 新增计划
            </button>
        </div>

        {/* Add Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-notion-dark/30 backdrop-blur-sm p-4">
                <div className="bg-white/80 dark:bg-notion-bg w-full max-w-md rounded-3xl shadow-2xl p-6 border border-white/20 animate-in zoom-in-95 duration-200 backdrop-blur-xl transition-colors">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-notion-text">新增待安排计划</h3>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-notion-dim hover:text-notion-text"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-notion-dim uppercase">计划内容</label>
                            <input 
                                autoFocus
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                className="w-full p-3 bg-notion-sidebar rounded-xl border-none outline-none text-notion-text focus:ring-2 focus:ring-notion-accentText/20"
                                placeholder="想做些什么？"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-notion-dim uppercase">优先级 (象限)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(Quadrant).filter(v => typeof v === 'number').map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => setNewQuadrant(q as Quadrant)}
                                        className={`p-3 rounded-xl border text-sm font-medium transition-all text-left ${
                                            newQuadrant === q 
                                            ? `${MORANDI_COLORS[q as Quadrant].bg} ${MORANDI_COLORS[q as Quadrant].border} ${MORANDI_COLORS[q as Quadrant].text} ring-1 ring-offset-1 ring-notion-border` 
                                            : 'bg-notion-sidebar border-notion-border text-notion-dim hover:bg-notion-hover'
                                        }`}
                                    >
                                        {QUADRANT_TITLES[q as Quadrant]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-notion-dim uppercase">任务属性</label>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setNewType('once')}
                                    className={`flex-1 p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${
                                        newType === 'once' ? 'bg-notion-text text-white border-notion-text' : 'bg-notion-sidebar border-notion-border text-notion-dim'
                                    }`}
                                >
                                    <CheckCircle2 size={16}/> 一次性任务
                                </button>
                                <button 
                                    onClick={() => setNewType('longterm')}
                                    className={`flex-1 p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${
                                        newType === 'longterm' ? 'bg-notion-text text-white border-notion-text' : 'bg-notion-sidebar border-notion-border text-notion-dim'
                                    }`}
                                >
                                    <Repeat size={16}/> 长期任务
                                </button>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleAddSubmit}
                        disabled={!newTitle.trim()}
                        className="w-full mt-8 py-3 bg-notion-accentText text-white dark:text-black rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        放入计划池
                    </button>
                </div>
            </div>
        )}

        {/* Task Detail / Schedule Modal */}
        {selectedTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-notion-dark/30 backdrop-blur-sm p-4">
                <div className="bg-white/80 dark:bg-notion-bg w-full max-w-md rounded-3xl shadow-2xl p-6 border border-white/20 animate-in zoom-in-95 duration-200 backdrop-blur-xl transition-colors">
                    <div className="flex justify-between items-center mb-6 border-b border-notion-border pb-4">
                        <input 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="text-lg font-bold text-notion-text bg-transparent border-none outline-none flex-1 mr-4 focus:bg-notion-sidebar/50 rounded-lg px-2 -ml-2"
                        />
                        <button onClick={() => setSelectedTask(null)} className="text-notion-dim hover:text-notion-text"><X size={20}/></button>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-notion-sidebar/50 p-4 rounded-xl border border-notion-border">
                            <h4 className="text-xs font-bold text-notion-dim uppercase mb-3 flex items-center gap-2">
                                <Calendar size={14}/> 安排日程
                            </h4>
                            
                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-notion-dim">开始日期 (及之后)</label>
                                    <input 
                                        type="date" 
                                        min={new Date().toISOString().split('T')[0]}
                                        value={scheduleStartDate}
                                        onChange={(e) => setScheduleStartDate(e.target.value)}
                                        className="w-full p-2 bg-notion-bg rounded-lg border border-notion-border text-sm outline-none focus:ring-1 focus:ring-notion-accentText text-notion-text"
                                    />
                                </div>

                                {selectedTask.type === 'longterm' && (
                                    <div className="flex flex-col gap-1 animate-in slide-in-from-top-2">
                                        <label className="text-xs text-notion-dim">结束日期</label>
                                        <input 
                                            type="date" 
                                            min={scheduleStartDate}
                                            value={scheduleEndDate}
                                            onChange={(e) => setScheduleEndDate(e.target.value)}
                                            className="w-full p-2 bg-notion-bg rounded-lg border border-notion-border text-sm outline-none focus:ring-1 focus:ring-notion-accentText text-notion-text"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => handleDetailAction('schedule')}
                                className="w-full mt-4 py-2.5 bg-notion-accent text-notion-accentText rounded-xl text-sm font-bold hover:brightness-95 transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowRight size={16}/> 
                                {selectedTask.type === 'once' ? '移入日历待办' : '批量生成日程'}
                            </button>
                            <p className="text-[10px] text-notion-dim text-center mt-2 opacity-70">
                                {selectedTask.type === 'once' 
                                    ? '一次性任务安排后将从计划池移除' 
                                    : '长期任务安排后仍保留在计划池中'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-between items-center pt-4 border-t border-notion-border">
                        <button 
                            onClick={() => handleDetailAction('delete')}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg hover:text-red-600 transition-colors flex items-center gap-1 text-sm"
                        >
                            <Trash2 size={16}/> 删除
                        </button>
                        <button 
                            onClick={() => handleDetailAction('save')}
                            className="px-6 py-2 bg-notion-text text-white dark:text-black rounded-xl text-sm font-medium hover:opacity-90"
                        >
                            保存修改
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};
