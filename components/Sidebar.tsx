import React from 'react';
import { ViewMode } from '../types';
import { Calendar, FileText, LayoutDashboard, Settings, Coffee, NotebookText, Heart } from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  isMobile: boolean;
  isOpen: boolean;
  toggleOpen: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, onOpenSettings }) => {
  const baseClass = `sidebar-container fixed md:static inset-y-0 left-0 z-40 w-72 bg-notion-sidebar border-r border-notion-border transform transition-transform duration-300 cubic-bezier(0.2, 0, 0, 1) ${
    isOpen ? 'translate-x-0' : '-translate-x-full'
  } md:translate-x-0 flex flex-col backdrop-blur-xl bg-opacity-90`;

  const MenuItem = ({ view, icon: Icon, label }: { view: ViewMode; icon: any; label: string }) => (
    <button
      onClick={() => setView(view)}
      className={`sidebar-item w-full flex items-center gap-3 px-5 py-3 text-sm font-medium rounded-2xl transition-all duration-200 mx-2 mb-1 w-[calc(100%-1rem)] ${
        currentView === view
          ? 'bg-notion-accent text-notion-accentText shadow-sm'
          : 'text-notion-text hover:bg-white/50 hover:shadow-sm'
      }`}
    >
      <Icon size={18} className={currentView === view ? 'text-notion-accentText' : 'text-notion-dim'} />
      {label}
    </button>
  );

  return (
    <div className={baseClass}>
      <div className="p-8 flex items-center gap-3 mb-2 sidebar-header">
        <div className="relative group cursor-pointer">
            {/* Morandi background shape (Soft Beige/Latte) */}
            <div className="w-10 h-10 bg-[#E6DCCF] rounded-[14px] flex items-center justify-center text-[#8C7B75] shadow-sm transform transition-transform group-hover:rotate-6 group-hover:scale-105">
                <NotebookText size={20} />
            </div>
            {/* Cute accent (Soft Pink Heart) */}
            <div className="absolute -bottom-1 -right-1 bg-[#F2EBEB] p-0.5 rounded-full border-2 border-notion-sidebar">
                <Heart size={10} fill="#DFA9A9" stroke="#DFA9A9" />
            </div>
        </div>
        <span className="font-display font-bold text-xl text-notion-text tracking-tight">小记 <span className="text-xs font-normal text-notion-dim opacity-70">LifeNote</span></span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto sidebar-nav">
        <div className="px-4 py-2 text-xs font-semibold text-notion-dim uppercase tracking-wider">概览</div>
        <MenuItem view={ViewMode.DASHBOARD} icon={LayoutDashboard} label="仪表盘" />
        <MenuItem view={ViewMode.DAILY_REVIEW} icon={Coffee} label="每日回顾" />
        
        <div className="mt-6 px-4 py-2 text-xs font-semibold text-notion-dim uppercase tracking-wider">管理</div>
        <MenuItem view={ViewMode.CALENDAR} icon={Calendar} label="日历 & 待办" />
        <MenuItem view={ViewMode.NOTES} icon={FileText} label="笔记 & 灵感" />
      </nav>

      <div className="p-4 border-t border-notion-border sidebar-footer">
         <button 
           onClick={onOpenSettings}
           className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium rounded-2xl text-notion-dim hover:bg-white/60 hover:text-notion-text hover:shadow-sm transition-all"
         >
           <Settings size={18} />
           <span>系统设置</span>
         </button>
      </div>
    </div>
  );
};