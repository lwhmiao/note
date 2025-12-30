import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AppSettings } from '../types';
import { Send, Sparkles, X, Loader2, Settings, User, Bot, Image as ImageIcon, Trash2, Upload, Save, Copy, Check, Palette, Edit3, MessageSquare, RotateCw } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onUserPost: (text: string, image?: string) => void;
  onTriggerAI: (regenerate?: boolean) => void; // Support regenerate
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
  
  // Menu & Edit State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const longPressTimer = useRef<any>(null);

  // Draggable State
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const displayMessages = messages.filter(m => m.role === 'user' || m.role === 'model' || (m.role === 'system' && m.isError));
  
  const lastMessageIsUser = displayMessages.length > 0 && displayMessages[displayMessages.length - 1].role === 'user';
  // Check if we should show regenerate button (last message is User OR last message is AI)
  const canRegenerate = displayMessages.length > 0 && !isLoading;

  useEffect(() => {
    if (showSettings) setTempSettings(settings);
  }, [showSettings, settings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, showSettings, editingId]);

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

  // --- Drag Logic ---
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
      if (!isDragging) {
          setIsOpen(true);
      }
  };

  // --- Chat Logic ---
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
      if (file.size > 500 * 1024) { alert("图片过大，请选择 500KB 以内的图片"); return; }
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

  // --- Message Menu Logic ---
  const startLongPress = (id: string) => {
    setActiveMenuId(null);
    longPressTimer.current = setTimeout(() => {
      setActiveMenuId(id);
    }, 600); // 600ms long press
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      setActiveMenuId(id);
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
      // Prevent bubble click or other events
      e.stopPropagation();
      e.preventDefault();
      
      // Use logic without confirm if needed, or stick to confirm but ensure it fires
      if(window.confirm("确定删除这条消息吗？")) {
        onDeleteMessage(id);
      }
      setActiveMenuId(null); 
  };

  const handleCopyText = (e: React.MouseEvent, text: string) => {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(text);
      setActiveMenuId(null);
      alert("已复制");
  };

  const cssTemplate = `/* 
.sidebar-container, .chat-bubble, .chat-message-row 
*/
/* 示例：我的气泡变蓝 */
.chat-message-row:not(.chat-message-row:has(.bg-white)) .chat-bubble {
  background-color: #3b82f6 !important; 
  color: white !important;
}`;

  if (!isOpen) {
    return (
      <div
        style={{ left: position.x, top: position.y }}
        className="fixed z-50 touch-none"
      >
          <button
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            onClick={handleClick}
            className="w-14 h-14 bg-notion-accentText text-white rounded-full shadow-float flex items-center justify-center hover:scale-105 transition-transform cursor-grab active:cursor-grabbing group relative"
          >
            <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse border border-white" />
          </button>
      </div>
    );
  }

  // --- Settings Panel ---
  if (showSettings) {
      return (
        <div className="fixed inset-0 z-[70] bg-notion-bg flex flex-col">
            {/* ... Keep settings panel content same, only changing top header/close button if needed ... */}
           <div className="p-4 border-b border-notion-border flex justify-between items-center bg-white">
             <h3 className="font-bold text-notion-text flex items-center gap-2 text-lg"><Settings size={20}/> 个性化设置</h3>
             <button onClick={() => setShowSettings(false)} className="text-notion-dim hover:text-notion-text p-2 bg-notion-sidebar rounded-full"><X size={20}/></button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl mx-auto w-full">
              {/* Settings Content */}
              <section className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-notion-border">
                 <h4 className="text-xs font-bold text-notion-dim uppercase tracking-wider flex items-center gap-2"><Bot size={14}/> AI 角色设定</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-notion-text">AI 名字</label>
                        <input className="w-full p-3 rounded-xl bg-notion-sidebar border-none text-sm focus:ring-2 focus:ring-notion-accent/50" value={tempSettings.aiName} onChange={e => setTempSettings({...tempSettings, aiName: e.target.value})}/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-notion-text">AI 头像</label>
                        <div className="flex gap-2">
                            <input className="flex-1 p-3 rounded-xl bg-notion-sidebar border-none text-xs font-mono truncate" value={tempSettings.aiAvatarUrl} onChange={e => setTempSettings({...tempSettings, aiAvatarUrl: e.target.value})}/>
                            <label className="p-3 bg-notion-sidebar hover:bg-notion-hover rounded-xl cursor-pointer"><Upload size={18} className="text-notion-dim"/><input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'aiAvatarUrl')} /></label>
                            {tempSettings.aiAvatarUrl && <img src={tempSettings.aiAvatarUrl} className="w-10 h-10 rounded-full object-cover border border-notion-border"/>}
                        </div>
                    </div>
                 </div>
                 <textarea className="w-full p-4 rounded-xl bg-notion-sidebar border-none text-sm h-24 resize-none" value={tempSettings.aiPersona} onChange={e => setTempSettings({...tempSettings, aiPersona: e.target.value})}/>
              </section>

              <section className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-notion-border">
                 <h4 className="text-xs font-bold text-notion-dim uppercase tracking-wider flex items-center gap-2"><User size={14}/> 用户设定</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-notion-text">用户昵称</label>
                        <input className="w-full p-3 rounded-xl bg-notion-sidebar border-none text-sm" value={tempSettings.userName} onChange={e => setTempSettings({...tempSettings, userName: e.target.value})}/>
                    </div>
                     <div className="space-y-2">
                        <label className="text-xs font-medium text-notion-text">用户头像</label>
                        <div className="flex gap-2">
                            <input className="flex-1 p-3 rounded-xl bg-notion-sidebar border-none text-xs font-mono truncate" value={tempSettings.userAvatarUrl} onChange={e => setTempSettings({...tempSettings, userAvatarUrl: e.target.value})}/>
                            <label className="p-3 bg-notion-sidebar hover:bg-notion-hover rounded-xl cursor-pointer"><Upload size={18} className="text-notion-dim"/><input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'userAvatarUrl')} /></label>
                            {tempSettings.userAvatarUrl && <img src={tempSettings.userAvatarUrl} className="w-10 h-10 rounded-full object-cover border border-notion-border"/>}
                        </div>
                    </div>
                 </div>
                 <input className="w-full p-3 rounded-xl bg-notion-sidebar border-none text-sm" value={tempSettings.userPersona} onChange={e => setTempSettings({...tempSettings, userPersona: e.target.value})}/>
              </section>

              <section className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-notion-border">
                  <h4 className="text-xs font-bold text-notion-dim uppercase tracking-wider flex items-center gap-2"><Palette size={14}/> 记忆与外观</h4>
                  <div className="p-4 bg-notion-sidebar rounded-2xl border border-notion-border space-y-3">
                     <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-notion-dim uppercase">上下文记忆深度 (RAG Window)</label>
                        <span className="text-xs font-mono font-bold text-notion-accentText">{tempSettings.historyLimit} 条</span>
                     </div>
                     <input type="range" min="5" max="200" step="5" value={tempSettings.historyLimit} onChange={(e) => setTempSettings({...tempSettings, historyLimit: parseInt(e.target.value)})} className="w-full accent-notion-accentText h-2 bg-notion-border rounded-lg appearance-none cursor-pointer" />
                     <p className="text-[10px] text-notion-dim">AI 将携带最近 {tempSettings.historyLimit} 条聊天记录。</p>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-notion-border/50">
                    <label className="text-xs font-medium text-notion-text flex items-center gap-1"><ImageIcon size={12}/> 聊天背景图</label>
                    <div className="flex gap-2">
                        <input className="flex-1 p-3 rounded-xl bg-notion-sidebar border-none text-xs font-mono truncate" value={tempSettings.chatBackgroundImageUrl} onChange={e => setTempSettings({...tempSettings, chatBackgroundImageUrl: e.target.value})}/>
                        <label className="p-3 bg-notion-sidebar hover:bg-notion-hover rounded-xl cursor-pointer"><Upload size={18} className="text-notion-dim"/><input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'chatBackgroundImageUrl')} /></label>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-notion-border/50">
                     <div className="flex justify-between items-center">
                        <label className="text-xs font-medium text-notion-text flex items-center gap-1">自定义 CSS</label>
                        <button onClick={handleCopyCss} className="text-xs flex items-center gap-1 text-notion-accentText hover:text-notion-text transition-colors">{copied ? <Check size={12}/> : <Copy size={12}/>}{copied ? "已复制" : "复制模板"}</button>
                     </div>
                     <textarea className="w-full p-3 rounded-xl border-none text-xs font-mono h-32 bg-notion-sidebar placeholder:text-notion-dim/50" placeholder={cssTemplate} value={tempSettings.customCss} onChange={e => setTempSettings({...tempSettings, customCss: e.target.value})}/>
                  </div>
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
           
           {showClearConfirm && (
               <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                   <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                       <h3 className="text-lg font-bold text-notion-text mb-2">确定清空吗？</h3>
                       <p className="text-sm text-notion-dim mb-6">永久删除所有聊天记忆。</p>
                       <div className="flex gap-3">
                           <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-notion-sidebar hover:bg-notion-hover">取消</button>
                           <button onClick={() => { onClearHistory(); setShowClearConfirm(false); setShowSettings(false); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600">确认</button>
                       </div>
                   </div>
               </div>
           )}
        </div>
      );
  }

  // --- Main Full Screen Chat UI ---
  return (
    <div className="fixed inset-0 z-[60] bg-notion-bg flex flex-col animate-in slide-in-from-bottom-4 duration-300 overflow-x-hidden" style={{ 
        backgroundImage: settings.chatBackgroundImageUrl ? `url(${settings.chatBackgroundImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    }}>
      {settings.chatBackgroundImageUrl && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-0 pointer-events-none" />}

      {/* Header */}
      <div className="relative z-10 p-3 border-b border-notion-border flex justify-between items-center bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img src={settings.aiAvatarUrl} alt="AI" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
          <div className="flex flex-col">
             {isLoading ? (
                 <span className="font-display font-bold text-lg text-notion-accentText animate-pulse">对方正在输入...</span>
             ) : (
                 <span className="font-display font-bold text-lg text-notion-text">{settings.aiName}</span>
             )}
             {!isLoading && (
                 <span className="text-[10px] text-notion-dim truncate max-w-[200px]">{settings.aiPersona.slice(0, 30)}...</span>
             )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-notion-hover rounded-full text-notion-dim hover:text-notion-text transition-colors"><Settings size={20} /></button>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-notion-hover rounded-full text-notion-dim hover:text-notion-text transition-colors"><X size={22} /></button>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="relative z-10 flex-1 overflow-y-auto p-4 space-y-6 max-w-4xl mx-auto w-full pb-32 overflow-x-hidden" 
        onClick={() => setActiveMenuId(null)}
      >
        {displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-notion-dim space-y-6 opacity-60">
            <div className="w-20 h-20 bg-white rounded-full shadow-sm border border-notion-border flex items-center justify-center">
               <Sparkles size={40} className="text-notion-accentText" />
            </div>
            <p className="text-sm font-medium leading-relaxed">你好，{settings.userName}。<br/><span className="text-xs opacity-80">{settings.userPersona}</span></p>
          </div>
        )}
        
        {displayMessages.map((msg) => {
          const isUser = msg.role === 'user';
          const avatar = isUser ? settings.userAvatarUrl : settings.aiAvatarUrl;
          const isActive = activeMenuId === msg.id;
          const isEditingThis = editingId === msg.id;

          return (
            <div key={msg.id} className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} chat-message-row group relative`}>
               <img src={avatar} className="w-8 h-8 rounded-full object-cover border border-white shadow-sm mb-1 bg-white shrink-0" />
               
               <div className={`relative flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
                  
                  {/* Floating Action Menu - Simplified and robust */}
                  {isActive && (
                      <div 
                        className={`absolute bottom-full mb-2 z-20 bg-notion-dark text-white rounded-xl shadow-float flex items-center p-1.5 gap-1 animate-in zoom-in-95 fade-in duration-200 ${isUser ? 'right-0' : 'left-0'}`}
                        // Stop bubbling immediately to prevent closing the menu
                        onClick={e => { e.stopPropagation(); }}
                      >
                         <button type="button" onClick={(e) => handleCopyText(e, msg.text || "")} className="p-2 hover:bg-white/20 rounded-lg" title="复制"><Copy size={14}/></button>
                         <div className="w-px h-3 bg-white/20"></div>
                         <button type="button" onClick={(e) => { e.stopPropagation(); handleEditStart(msg); }} className="p-2 hover:bg-white/20 rounded-lg" title="编辑"><Edit3 size={14}/></button>
                         <div className="w-px h-3 bg-white/20"></div>
                         {/* Direct delete button without timeout tricks */}
                         <button type="button" onClick={(e) => handleDelete(e, msg.id)} className="p-2 hover:bg-red-500/50 text-red-300 hover:text-white rounded-lg" title="删除"><Trash2 size={14}/></button>
                      </div>
                  )}

                  {msg.image && (
                      <img src={msg.image} className="max-w-[200px] rounded-xl border border-notion-border shadow-sm mb-1" />
                  )}
                  
                  {isEditingThis ? (
                      <div className="w-full min-w-[200px] bg-white rounded-2xl p-3 border-2 border-notion-accentText shadow-lg flex flex-col gap-2 animate-in zoom-in-95">
                          <textarea 
                             className="w-full text-sm outline-none resize-none bg-transparent"
                             rows={3}
                             value={editText}
                             onChange={e => setEditText(e.target.value)}
                             autoFocus
                          />
                          <div className="flex justify-end gap-2">
                             <button onClick={() => setEditingId(null)} className="text-xs text-notion-dim px-2 py-1">取消</button>
                             <button onClick={handleEditSave} className="text-xs bg-notion-accentText text-white px-3 py-1 rounded-lg">保存</button>
                          </div>
                      </div>
                  ) : msg.text && (
                    <div 
                        onClick={(e) => { 
                             e.stopPropagation(); // Stop clicking bubble from closing the menu immediately if it was open
                             if (isActive) setActiveMenuId(null);
                             else setActiveMenuId(msg.id);
                        }}
                        className={`rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm chat-bubble break-words break-all whitespace-pre-wrap select-text cursor-pointer transition-all ${
                        isUser ? 'bg-notion-accentText text-white rounded-br-sm' : 
                        msg.isError ? 'bg-red-50 text-red-600 border border-red-100' : 
                        'bg-white text-notion-text border border-notion-border rounded-bl-sm'
                    } ${isActive ? 'ring-2 ring-offset-2 ring-notion-accentText/50 scale-[1.02]' : 'hover:scale-[1.01]'}`}>
                    {msg.text}
                    </div>
                  )}
               </div>
            </div>
          );
        })}
        {isLoading && (
           <div className="flex items-end gap-3">
              <img src={settings.aiAvatarUrl} className="w-8 h-8 rounded-full object-cover border border-white shadow-sm mb-1 bg-white" />
              <div className="bg-white px-5 py-3 rounded-2xl rounded-bl-sm border border-notion-border shadow-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-notion-accentText" />
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative z-10 p-4 border-t border-notion-border bg-white/90 backdrop-blur-md flex justify-center">
         
         <form onSubmit={handleSubmit} className="relative w-full max-w-4xl flex items-end gap-2">
            {pendingImage && (
                <div className="absolute bottom-full left-0 mb-4 p-2 bg-white rounded-xl shadow-lg border border-notion-border animate-in slide-in-from-bottom-2">
                    <img src={pendingImage} className="h-16 w-auto rounded-lg" />
                    <button type="button" onClick={() => setPendingImage(null)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"><X size={12}/></button>
                </div>
            )}
            
            <label className="p-3 bg-notion-sidebar hover:bg-notion-hover rounded-xl cursor-pointer transition-colors text-notion-dim hover:text-notion-accentText">
                <ImageIcon size={20} />
                <input type="file" accept="image/*" className="hidden" onChange={handleChatImageUpload} disabled={isLoading} />
            </label>

            <div className="flex-1 relative">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`发送给 ${settings.aiName}...`}
                    className="w-full pl-4 pr-24 py-3 bg-notion-sidebar rounded-xl border-none focus:ring-2 focus:ring-notion-accentText/20 text-sm outline-none transition-all placeholder:text-notion-dim/70 text-notion-text"
                    disabled={isLoading}
                />
                
                {/* Button Group inside Input */}
                <div className="absolute right-2 top-1.5 flex gap-1">
                    {/* Regenerate Button */}
                    {canRegenerate && (
                         <button
                            type="button"
                            onClick={() => onTriggerAI(true)}
                            disabled={isLoading}
                            className={`p-1.5 rounded-lg transition-all text-notion-dim hover:bg-white hover:text-notion-accentText`}
                            title="重新生成回复"
                         >
                            <RotateCw size={18} />
                         </button>
                    )}

                    {/* Trigger AI Button (Legacy manual trigger) */}
                    <button
                        type="button"
                        onClick={() => onTriggerAI(false)}
                        disabled={isLoading}
                        className={`p-1.5 rounded-lg transition-all ${lastMessageIsUser && !isLoading ? 'bg-notion-accentText text-white shadow-sm hover:opacity-90' : 'text-notion-dim hover:bg-white hover:text-notion-text opacity-50'}`}
                        title="让 AI 回复"
                    >
                        <Bot size={18} />
                    </button>

                   {/* User Send Button */}
                   <button
                        type="submit"
                        disabled={(!input.trim() && !pendingImage) || isLoading}
                        className="p-1.5 text-notion-dim hover:bg-white hover:text-notion-text rounded-lg transition-all disabled:opacity-30"
                        title="发送消息"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
         </form>
      </div>
    </div>
  );
};