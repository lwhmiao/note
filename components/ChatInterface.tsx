
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChatMessage, AppSettings } from '../types';
import { Send, Sparkles, X, Loader2, Settings, User, Bot, Image as ImageIcon, Trash2, Upload, Save, Copy, Check, Palette, Edit3, MessageSquare, RotateCw } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onUserPost: (text: string, image?: string) => void;
  onTriggerAI: (regenerate?: boolean) => void; 
  onDeleteMessage: (id: string) => void;
  onUpdateMessage: (id: string, newText: string) => void;
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  onClearHistory: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onUserPost,
  onTriggerAI,
  onDeleteMessage,
  onUpdateMessage,
  isLoading,
  isOpen,
  setIsOpen,
  settings,
  onUpdateSettings,
  onClearHistory
}) => {
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [copied, setCopied] = useState(false);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const longPressTimer = useRef<any>(null);

  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const displayMessages = messages.filter(m => m.role === 'user' || m.role === 'model' || (m.role === 'system' && m.isError));
  const canRegenerate = displayMessages.length > 0 && !isLoading;
  const lastMessageIsUser = displayMessages.length > 0 && displayMessages[displayMessages.length - 1].role === 'user';

  useEffect(() => {
    if (showSettings) setTempSettings(settings);
  }, [showSettings, settings]);

  useLayoutEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, showSettings]);

  useEffect(() => {
     if (settings.customCss) {
         const styleId = 'lifeos-custom-css';
         let styleEl = document.getElementById(styleId);
         if (!styleEl) {
             styleEl = document.createElement('style');
             styleEl.id = styleId;
             document.head.appendChild(styleEl);
         }
         styleEl.textContent = settings.customCss;
     }
  }, [settings.customCss]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setIsDragging(false);
    dragStartPos.current = { x: clientX, y: clientY };
    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      const diffX = Math.abs(moveX - dragStartPos.current.x);
      const diffY = Math.abs(moveY - dragStartPos.current.y);
      if (diffX > 5 || diffY > 5) {
          setIsDragging(true);
          setPosition({ x: moveX - 28, y: moveY - 28 });
      }
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
  };

  const handleClick = () => {
      if (!isDragging) setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pendingImage) || isLoading) return;
    onUserPost(input, pendingImage || undefined);
    setInput('');
    setPendingImage(null);
  };

  const handleSaveSettings = () => {
    onUpdateSettings(tempSettings);
    setShowSettings(false);
  };

  const handleCopyCss = () => {
      navigator.clipboard.writeText(tempSettings.customCss || cssTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'aiAvatarUrl' | 'userAvatarUrl' | 'chatBackgroundImageUrl') => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => setTempSettings(prev => ({ ...prev, [field]: reader.result as string }));
      reader.readAsDataURL(file);
  };

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditStart = (msg: ChatMessage) => {
      setEditingId(msg.id);
      setEditText(msg.text || '');
      setActiveMenuId(null);
  };

  const handleEditSave = () => {
      if (editingId && editText.trim()) {
          onUpdateMessage(editingId, editText);
      }
      setEditingId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(window.confirm("确定删除这条消息吗？")) {
        onDeleteMessage(id);
      }
      setActiveMenuId(null); 
  };

  const handleCopyText = (e: React.MouseEvent, text: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      setActiveMenuId(null);
      alert("已复制");
  };

  const cssTemplate = `/* 自定义样式 */`;

  if (!isOpen) {
    return (
      <div style={{ left: position.x, top: position.y }} className="fixed z-50 touch-none">
          <button onMouseDown={handleMouseDown} onTouchStart={handleMouseDown} onClick={handleClick} className="w-14 h-14 bg-notion-accentText text-white rounded-full shadow-float flex items-center justify-center hover:scale-105 transition-transform cursor-grab active:cursor-grabbing group relative">
            <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse border border-white" />
          </button>
      </div>
    );
  }

  if (showSettings) {
      return (
        <div className="fixed inset-0 z-[70] bg-notion-bg flex flex-col">
           <div className="p-4 border-b border-notion-border flex justify-between items-center bg-white">
             <h3 className="font-bold text-notion-text flex items-center gap-2 text-lg"><Settings size={20}/> 个性化设置</h3>
             <button onClick={() => setShowSettings(false)} className="text-notion-dim hover:text-notion-text p-2 bg-notion-sidebar rounded-full"><X size={20}/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl mx-auto w-full">
              <section className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-notion-border">
                 <h4 className="text-xs font-bold text-notion-dim uppercase tracking-wider flex items-center gap-2"><Bot size={14}/> AI 角色设定</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-notion-text">AI 名字</label>
                        <input className="w-full p-3 rounded-xl bg-notion-sidebar border-none text-sm" value={tempSettings.aiName} onChange={e => setTempSettings({...tempSettings, aiName: e.target.value})}/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-notion-text">AI 头像</label>
                        <div className="flex gap-2">
                            <input className="flex-1 p-3 rounded-xl bg-notion-sidebar border-none text-xs truncate" value={tempSettings.aiAvatarUrl} onChange={e => setTempSettings({...tempSettings, aiAvatarUrl: e.target.value})}/>
                            <label className="p-3 bg-notion-sidebar hover:bg-notion-hover rounded-xl cursor-pointer"><Upload size={18} /><input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'aiAvatarUrl')} /></label>
                        </div>
                    </div>
                 </div>
                 <textarea className="w-full p-4 rounded-xl bg-notion-sidebar border-none text-sm h-24 resize-none" value={tempSettings.aiPersona} onChange={e => setTempSettings({...tempSettings, aiPersona: e.target.value})}/>
              </section>
              <div className="pt-4 pb-20">
                  <button onClick={() => setShowClearConfirm(true)} className="w-full py-4 rounded-xl border border-red-100 bg-red-50/50 text-red-500 hover:bg-red-50 flex items-center justify-center gap-2 font-medium">
                    <Trash2 size={16} /> 清空所有聊天记录
                  </button>
              </div>
           </div>
           <div className="p-4 border-t border-notion-border bg-white flex justify-end">
              <button onClick={handleSaveSettings} className="flex items-center gap-2 px-8 py-3 bg-notion-accentText text-white rounded-2xl font-bold shadow-lg shadow-pink-200/50 hover:opacity-90">
                 <Save size={18} /> 保存并生效
              </button>
           </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-notion-bg flex flex-col animate-in slide-in-from-bottom-4 duration-300 overflow-x-hidden" style={{ backgroundImage: settings.chatBackgroundImageUrl ? `url(${settings.chatBackgroundImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="relative z-10 p-3 border-b border-notion-border flex justify-between items-center bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img src={settings.aiAvatarUrl} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
          <span className="font-display font-bold text-lg text-notion-text">{isLoading ? '正在输入...' : settings.aiName}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowSettings(true)} className="p-2 text-notion-dim hover:text-notion-text"><Settings size={20} /></button>
          <button onClick={() => setIsOpen(false)} className="p-2 text-notion-dim hover:text-notion-text"><X size={22} /></button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto p-4 space-y-6 max-w-4xl mx-auto w-full pb-6" onClick={() => setActiveMenuId(null)}>
        {displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40 py-20">
            <Sparkles size={48} className="text-notion-accentText mb-4" />
            <p className="text-sm font-medium">你好，{settings.userName}。</p>
          </div>
        )}
        
        {displayMessages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const avatar = isUser ? settings.userAvatarUrl : settings.aiAvatarUrl;
          const isActive = activeMenuId === msg.id;
          const isEditingThis = editingId === msg.id;

          return (
            <div key={msg.id} className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group relative`}>
               <img src={avatar} className="w-10 h-10 rounded-full object-cover shrink-0 bg-white" />
               <div className={`relative flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
                  {isActive && (
                      <div className={`absolute ${index === 0 ? 'top-full mt-2' : 'bottom-full mb-2'} z-20 bg-notion-dark text-white rounded-xl shadow-float flex items-center p-1.5 gap-1 animate-in zoom-in-95 ${isUser ? 'right-0' : 'left-0'}`}>
                         <button onClick={(e) => handleCopyText(e, msg.text || "")} className="p-2 hover:bg-white/20 rounded-lg"><Copy size={14}/></button>
                         <button onClick={(e) => { e.stopPropagation(); handleEditStart(msg); }} className="p-2 hover:bg-white/20 rounded-lg"><Edit3 size={14}/></button>
                         <button onClick={(e) => handleDelete(e, msg.id)} className="p-2 hover:bg-red-500/50 rounded-lg text-red-300"><Trash2 size={14}/></button>
                      </div>
                  )}
                  {msg.image && <img src={msg.image} className="max-w-[200px] rounded-xl mb-1 shadow-sm" />}
                  {isEditingThis ? (
                      <div className="w-full min-w-[200px] bg-white rounded-2xl p-3 border-2 border-notion-accentText shadow-lg flex flex-col gap-2">
                          <textarea className="w-full text-sm outline-none resize-none" rows={3} value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
                          <div className="flex justify-end gap-2">
                             <button onClick={() => setEditingId(null)} className="text-xs text-notion-dim">取消</button>
                             <button onClick={handleEditSave} className="text-xs bg-notion-accentText text-white px-3 py-1 rounded-lg">保存</button>
                          </div>
                      </div>
                  ) : msg.text && (
                    <div onClick={(e) => { e.stopPropagation(); setActiveMenuId(isActive ? null : msg.id); }} className={`rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap transition-all ${isUser ? 'bg-notion-accentText text-white rounded-br-sm' : 'bg-white text-notion-text border border-notion-border rounded-bl-sm'}`}>
                    {msg.text}
                    </div>
                  )}
               </div>
            </div>
          );
        })}
        {isLoading && (
           <div className="flex items-end gap-3">
              <img src={settings.aiAvatarUrl} className="w-10 h-10 rounded-full" />
              <div className="bg-white px-5 py-3 rounded-2xl rounded-bl-sm border border-notion-border shadow-sm">
                <Loader2 size={16} className="animate-spin text-notion-accentText" />
              </div>
           </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="relative z-10 p-4 border-t border-notion-border bg-white/90 backdrop-blur-md">
         <form onSubmit={handleSubmit} className="relative w-full max-w-4xl mx-auto flex items-end gap-2">
            {pendingImage && (
                <div className="absolute bottom-full left-0 mb-4 p-2 bg-white rounded-xl shadow-lg border">
                    <img src={pendingImage} className="h-16 w-auto rounded-lg" />
                    <button type="button" onClick={() => setPendingImage(null)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"><X size={12}/></button>
                </div>
            )}
            <label className="p-3 bg-notion-sidebar hover:bg-notion-hover rounded-xl cursor-pointer text-notion-dim transition-colors"><ImageIcon size={20} /><input type="file" accept="image/*" className="hidden" onChange={handleChatImageUpload} disabled={isLoading} /></label>
            <div className="flex-1 relative">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`发送给 ${settings.aiName}...`} className="w-full pl-4 pr-24 py-3 bg-notion-sidebar rounded-xl border-none text-sm outline-none" disabled={isLoading} />
                <div className="absolute right-2 top-1.5 flex gap-1">
                    {canRegenerate && <button type="button" onClick={() => onTriggerAI(true)} disabled={isLoading} className="p-1.5 text-notion-dim hover:text-notion-accentText"><RotateCw size={18} /></button>}
                    <button type="button" onClick={() => onTriggerAI(false)} disabled={isLoading} className={`p-1.5 rounded-lg ${lastMessageIsUser && !isLoading ? 'bg-notion-accentText text-white' : 'text-notion-dim hover:text-notion-text'}`}><Bot size={18} /></button>
                    <button type="submit" disabled={(!input.trim() && !pendingImage) || isLoading} className="p-1.5 text-notion-dim hover:text-notion-text"><Send size={18} /></button>
                </div>
            </div>
         </form>
      </div>
    </div>
  );
};
