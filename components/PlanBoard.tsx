
import React, { useState } from 'react';
import { BacklogTask, Quadrant, TaskType } from '../types';
import { Plus, Grid, List, X, Calendar, Edit3, Trash2, ArrowRight, Repeat, CheckCircle2 } from 'lucide-react';

interface PlanBoardProps {
  tasks: BacklogTask[];
  onAddBacklogTask: (title: string, quadrant: Quadrant, type: TaskType) => void;
  onUpdateBacklogTask: (id: string, updates: Partial<BacklogTask>) => void;
  onDeleteBacklogTask: (id: string) => void;
  onScheduleTask: (task: BacklogTask, startDate: string, endDate?: string) => void;
}

const MORANDI_COLORS = {
  [Quadrant.Q1]: { bg: 'bg-red-50/60', border: 'border-red-100', text: 'text-red-900', badge: 'bg-red-100 text-red-700' }, // Urgent Important
  [Quadrant.Q2]: { bg: 'bg-blue-50/60', border: 'border-blue-100', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-700' }, // Not Urgent Important
  [Quadrant.Q3]: { bg: 'bg-orange-50/60', border: 'border-orange-100', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-700' }, // Urgent Not Important
  [Quadrant.Q4]: { bg: 'bg-gray-50/60', border: 'border-gray-100', text: 'text-gray-900', badge: 'bg-gray-100 text-gray-700' }, // Not Urgent Not Important
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default list on mobile
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BacklogTask | null>(null); // For detail/edit/schedule
  
  // Add Form State
  const [newTitle, setNewTitle] = useState('');
  const [newQuadrant, setNewQuadrant] = useState<Quadrant>(Quadrant.Q2);
  const [newType, setNewType] = useState<TaskType>('once');

  // Edit/Schedule State
  const [editTitle, setEditTitle] = useState('');
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');

  // Drag State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('taskId', id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, targetQuadrant: Quadrant) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (id) {
        onUpdateBacklogTask(id, { quadrant: targetQuadrant });
    }
    setDraggedTaskId(null);
  };

  const openAddModal = () => {
      setNewTitle('');
      setNewQuadrant(Quadrant.Q2);
      setNewType('once');
      setIsAddModalOpen(true);
  };

  const openDetailModal = (task: BacklogTask) => {
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
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, q)}
            className={`flex flex-col h-full rounded-2xl border ${style.border} ${style.bg} transition-colors p-4 relative overflow-hidden`}
          >
              <h3 className={`font-bold text-sm mb-3 uppercase tracking-wider ${style.text} flex justify-between items-center`}>
                  {QUADRANT_TITLES[q]}
                  <span className="text-xs opacity-60 bg-white/50 px-2 py-0.5 rounded-full">{qTasks.length}</span>
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                  {qTasks.map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => openDetailModal(task)}
                        className={`bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-white shadow-sm cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-transform group`}
                      >
                          <div className="flex justify-between items-start gap-2">
                              <span className="text-sm text-notion-text font-medium leading-snug">{task.title}</span>
                              {task.type === 'longterm' && (
                                  <Repeat size={12} className="text-notion-accentText mt-1 flex-shrink-0" />
                              )}
                          </div>
                      </div>
                  ))}
                  {qTasks.length === 0 && (
                      <div className="h-full flex items-center justify-center text-xs opacity-30 italic font-medium">
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
            
            <div className="md:hidden bg-white rounded-lg p-1 border border-notion-border flex">
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-notion-sidebar text-notion-accentText' : 'text-notion-dim'}`}><List size={18}/></button>
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-notion-sidebar text-notion-accentText' : 'text-notion-dim'}`}><Grid size={18}/></button>
            </div>
        </div>

        {/* Board Area */}
        <div className="flex-1 p-4 md:p-6 overflow-hidden">
             {/* Desktop is always grid, Mobile depends on toggle */}
             <div className={`h-full w-full gap-4 ${viewMode === 'grid' || window.innerWidth >= 768 ? 'grid grid-cols-2 grid-rows-2' : 'flex flex-col space-y-4 overflow-y-auto pb-20'}`}>
                 <QuadrantSection q={Quadrant.Q1} />
                 <QuadrantSection q={Quadrant.Q2} />
                 <QuadrantSection q={Quadrant.Q3} />
                 <QuadrantSection q={Quadrant.Q4} />
             </div>
        </div>

        {/* Floating Add Button */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <button 
                onClick={openAddModal}
                className="flex items-center gap-2 px-8 py-3 bg-notion-accentText text-white rounded-full shadow-lg shadow-pink-200/50 hover:scale-105 transition-transform font-bold"
            >
                <Plus size={20} /> 新增计划
            </button>
        </div>

        {/* Add Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-notion-dark/30 backdrop-blur-sm p-4">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border border-white/50 animate-in zoom-in-95 duration-200">
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
                                            : 'bg-white border-notion-border text-notion-dim hover:bg-notion-sidebar'
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
                                        newType === 'once' ? 'bg-notion-text text-white border-notion-text' : 'bg-white border-notion-border text-notion-dim'
                                    }`}
                                >
                                    <CheckCircle2 size={16}/> 一次性任务
                                </button>
                                <button 
                                    onClick={() => setNewType('longterm')}
                                    className={`flex-1 p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${
                                        newType === 'longterm' ? 'bg-notion-text text-white border-notion-text' : 'bg-white border-notion-border text-notion-dim'
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
                        className="w-full mt-8 py-3 bg-notion-accentText text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        放入计划池
                    </button>
                </div>
            </div>
        )}

        {/* Task Detail / Schedule Modal */}
        {selectedTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-notion-dark/30 backdrop-blur-sm p-4">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border border-white/50 animate-in zoom-in-95 duration-200">
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
                                        className="w-full p-2 bg-white rounded-lg border border-notion-border text-sm outline-none focus:ring-1 focus:ring-notion-accentText"
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
                                            className="w-full p-2 bg-white rounded-lg border border-notion-border text-sm outline-none focus:ring-1 focus:ring-notion-accentText"
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
                            className="px-6 py-2 bg-notion-text text-white rounded-xl text-sm font-medium hover:opacity-90"
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
