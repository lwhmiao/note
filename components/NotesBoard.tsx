
import React, { useState, useMemo } from 'react';
import { Note } from '../types';
import { Trash2, Lightbulb, StickyNote, BookOpen, Search, X, Edit3, Send, Save, Calendar, Plus, FolderOpen, Filter } from 'lucide-react';

interface NotesBoardProps {
  notes: Note[];
  onDeleteNote: (id: string) => void;
  onAddNote: (content: string, type: Note['type']) => void;
  onUpdateNote: (id: string, content: string) => void;
}

export const NotesBoard: React.FC<NotesBoardProps> = ({ notes, onDeleteNote, onAddNote, onUpdateNote }) => {
  const [activeMonth, setActiveMonth] = useState<string>('all');
  const [activeType, setActiveType] = useState<Note['type'] | 'all'>('all');
  
  // Search State
  const [searchInput, setSearchInput] = useState(''); // Text in input
  const [searchQuery, setSearchQuery] = useState(''); // Actual filter trigger
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  
  // Edit State
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const categories = [
    { id: 'all', label: '全部' },
    { id: 'inspiration', label: '灵感', icon: Lightbulb },
    { id: 'rambling', label: '碎碎念', icon: StickyNote },
    { id: 'journal', label: '日记', icon: BookOpen },
  ];

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    notes.forEach(note => {
        const date = new Date(note.createdAt);
        months.add(`${date.getFullYear()}年${date.getMonth() + 1}月`);
    });
    return Array.from(months).sort((a, b) => {
        const parse = (s: string) => {
            const [y, m] = s.split('年');
            return new Date(parseInt(y), parseInt(m.replace('月','')) - 1).getTime();
        };
        return parse(b) - parse(a);
    });
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes
      .filter(n => {
          if (activeMonth === 'all') return true;
          const date = new Date(n.createdAt);
          const key = `${date.getFullYear()}年${date.getMonth() + 1}月`;
          return key === activeMonth;
      })
      .filter(n => activeType === 'all' ? true : n.type === activeType)
      .filter(n => {
          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          const contentMatch = (n.content || '').toLowerCase().includes(query);
          const titleMatch = n.title ? (n.title || '').toLowerCase().includes(query) : false;
          return contentMatch || titleMatch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes, activeMonth, activeType, searchQuery]);

  const handleAddSubmit = () => {
    if (!newNoteContent.trim()) return;
    onAddNote(newNoteContent, activeType === 'all' ? 'rambling' : activeType as Note['type']);
    setNewNoteContent('');
    setIsCreating(false);
  };

  const openNote = (note: Note) => {
    setSelectedNote(note);
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (selectedNote) {
      onUpdateNote(selectedNote.id, editContent);
      setSelectedNote({ ...selectedNote, content: editContent });
      setIsEditing(false);
    }
  };

  const executeSearch = () => {
      setSearchQuery(searchInput);
  };

  return (
    <div className="h-full flex flex-col bg-texture overflow-hidden relative">
      
      {/* Top Search & Filter Bar */}
      <div className="p-4 bg-notion-bg/50 backdrop-blur-sm flex items-center justify-between gap-4 z-20">
          <div className="flex-1 relative flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-notion-dim" size={16} />
                    <input 
                        type="text" 
                        placeholder="搜索..." 
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                        className="w-full pl-9 pr-4 py-2.5 bg-notion-sidebar rounded-xl border border-notion-border focus:ring-2 focus:ring-notion-accentText/20 outline-none text-sm transition-all shadow-sm text-notion-text placeholder:text-notion-dim/50"
                    />
                </div>
                <button 
                    onClick={executeSearch}
                    className="bg-notion-accentText text-white dark:text-black px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
                >
                    搜索
                </button>
            </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24">
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
                <button
                key={cat.id}
                onClick={() => setActiveType(cat.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all border whitespace-nowrap flex items-center gap-2 ${
                    activeType === cat.id
                    ? 'bg-notion-text border-notion-text text-notion-bg shadow-md'
                    : 'bg-notion-sidebar border-notion-border text-notion-dim hover:border-notion-accentText hover:text-notion-accentText'
                }`}
                >
                {cat.icon && <cat.icon size={14}/>}
                {cat.label}
                </button>
            ))}
        </div>

        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {filteredNotes.map(note => (
                <div 
                    key={note.id} 
                    onClick={() => openNote(note)}
                    className="break-inside-avoid bg-white/80 dark:bg-notion-sidebar p-6 rounded-2xl border border-notion-border shadow-sm hover:shadow-soft hover:border-notion-accentBorder transition-all cursor-pointer group hover:-translate-y-1"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full text-notion-accentText bg-notion-accent/50 border border-notion-accentBorder`}>
                        {categories.find(c => c.id === note.type)?.label}
                        </span>
                        <span className="text-xs text-notion-dim font-mono">
                            {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                    <p className="text-sm text-notion-text whitespace-pre-wrap leading-relaxed line-clamp-[8] font-sans">
                        {note.content}
                    </p>
                </div>
            ))}
        </div>
        
        {filteredNotes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-notion-dim opacity-60">
                <StickyNote size={48} className="mb-4 text-notion-border" />
                <p>没有找到笔记。</p>
            </div>
        )}
      </div>

      {/* Bottom Floating Action Bar (Wider Buttons) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full border border-notion-border shadow-float">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all min-w-[120px] ${isMenuOpen ? 'bg-notion-accent text-notion-accentText' : 'bg-transparent text-notion-text hover:bg-notion-hover'}`}
          >
            <FolderOpen size={18} />
            {activeMonth === 'all' ? '全部归档' : activeMonth}
          </button>
          <div className="w-px h-6 bg-notion-border"></div>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 px-8 py-2.5 bg-notion-accentText text-white dark:text-black rounded-full shadow-md shadow-pink-200/50 hover:opacity-90 transition-all font-bold text-sm min-w-[120px]"
          >
              <Plus size={18} /> 记一笔
          </button>
      </div>

      {/* Popover Navigation Menu (Positioned above bottom bar) */}
      {isMenuOpen && (
          <div 
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-64 bg-notion-bg rounded-2xl shadow-float border border-notion-border p-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="max-h-[50vh] overflow-y-auto">
                <div className="px-3 py-2 text-xs font-bold text-notion-dim uppercase tracking-wider">时间归档</div>
                <button
                    onClick={() => { setActiveMonth('all'); setIsMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors mb-1 flex justify-between items-center ${activeMonth === 'all' ? 'bg-notion-sidebar text-notion-accentText' : 'text-notion-text hover:bg-notion-hover'}`}
                >
                    全部笔记
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
        <div className="absolute inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
      )}

      {/* Create Modal */}
      {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-notion-dark/20 backdrop-blur-sm p-4">
              <div className="bg-white/80 dark:bg-notion-bg w-full max-w-lg rounded-3xl shadow-2xl p-6 border border-white/20 backdrop-blur-xl transition-colors">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-notion-text">记一笔</h3>
                      <button onClick={() => setIsCreating(false)}><X size={20} className="text-notion-dim hover:text-notion-text"/></button>
                  </div>
                  <textarea
                    autoFocus
                    className="w-full h-40 bg-notion-sidebar/50 rounded-xl p-4 border border-notion-border outline-none resize-none text-sm leading-relaxed mb-4 text-notion-text placeholder:text-notion-dim"
                    placeholder="此刻的想法..."
                    value={newNoteContent}
                    onChange={e => setNewNoteContent(e.target.value)}
                  />
                  <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                          {categories.filter(c => c.id !== 'all').map(c => (
                              <button 
                                key={c.id} 
                                onClick={() => setActiveType(c.id as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeType === c.id ? 'bg-notion-accent border-notion-accentText text-notion-accentText' : 'border-notion-border text-notion-dim hover:bg-notion-sidebar'}`}
                              >
                                  {c.label}
                              </button>
                          ))}
                      </div>
                      <button onClick={handleAddSubmit} className="bg-notion-accentText text-white dark:text-black px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-pink-200/50 hover:opacity-90 transition-opacity">
                          保存
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Detail/Edit Modal */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-notion-dark/20 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white/80 dark:bg-notion-bg w-full max-w-lg rounded-3xl shadow-2xl border border-white/20 flex flex-col max-h-[85vh] overflow-hidden backdrop-blur-xl transition-colors">
            <div className="p-4 border-b border-notion-border flex justify-between items-center bg-white/60 dark:bg-notion-sidebar/50 transition-colors">
              <div className="flex items-center gap-2">
                 {isEditing ? (
                   <span className="text-sm font-bold text-notion-text">编辑笔记</span>
                 ) : (
                   <span className="text-xs text-notion-dim font-mono">
                     {new Date(selectedNote.createdAt).toLocaleString('zh-CN')}
                   </span>
                 )}
              </div>
              <div className="flex gap-2">
                 {!isEditing && (
                   <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-notion-hover rounded-full text-notion-dim hover:text-notion-accentText transition-colors">
                     <Edit3 size={18} />
                   </button>
                 )}
                 <button onClick={() => setSelectedNote(null)} className="p-2 hover:bg-notion-hover rounded-full text-notion-dim hover:text-notion-text">
                   <X size={20} />
                 </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
               {isEditing ? (
                 <textarea 
                   className="w-full h-full min-h-[300px] resize-none outline-none text-base leading-relaxed text-notion-text bg-transparent"
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                 />
               ) : (
                 <div className="text-base leading-relaxed text-notion-text whitespace-pre-wrap font-sans">
                   {selectedNote.content}
                 </div>
               )}
            </div>

            <div className="p-4 border-t border-notion-border bg-white/60 dark:bg-notion-sidebar/30 flex justify-between items-center transition-colors">
               <button 
                 onClick={() => {
                    if(confirm("确定删除这条笔记吗？")) {
                       onDeleteNote(selectedNote.id);
                       setSelectedNote(null);
                    }
                 }}
                 className="text-red-400 hover:text-red-600 p-2 rounded-xl transition-colors text-sm flex items-center gap-1 hover:bg-red-50"
               >
                 <Trash2 size={16} /> 删除
               </button>
               
               {isEditing && (
                 <button 
                   onClick={handleSaveEdit}
                   className="bg-notion-accentText text-white dark:text-black px-6 py-2 rounded-xl font-medium shadow-lg shadow-pink-200/50 hover:opacity-90 transition-opacity flex items-center gap-2"
                 >
                   <Save size={16} /> 保存
                 </button>
               )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
