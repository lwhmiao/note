import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { CalendarView } from './components/CalendarView';
import { NotesBoard } from './components/NotesBoard';
import { Dashboard } from './components/Dashboard';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { DailyReview } from './components/DailyReview';
import { AppState, ViewMode, Task, Note, ChatMessage, AppSettings, DEFAULT_SETTINGS, ThemeId } from './types';
import { generateResponse } from './services/llm';
import { Menu } from 'lucide-react';

const initialState: AppState = {
  tasks: [],
  notes: [],
  summaries: []
};

// Theme Definitions - Ultra High Contrast Text
const THEMES: Record<ThemeId, Record<string, string>> = {
    sakura: {
        '--color-bg': '#F2EBEB',        
        '--color-sidebar': '#FBF7F7',   
        '--color-border': '#DBCACA',
        '--color-text': '#0F0F0F',      // Nearly Black
        '--color-dim': '#4A3A3A',       // Dark Brown
        '--color-hover': '#EBE0E0',
        '--color-accent': '#E8D5D5',
        '--color-accent-border': '#CCB0B0',
        '--color-accent-text': '#8F3A3A',
    },
    terracotta: {
        '--color-bg': '#EBE7E4',        
        '--color-sidebar': '#F5F2F0',
        '--color-border': '#D6CFC9',
        '--color-text': '#0F0F0F',      
        '--color-dim': '#4A3E3A',
        '--color-hover': '#E0D8D4',
        '--color-accent': '#D6C6B8',
        '--color-accent-border': '#B8A495',
        '--color-accent-text': '#7D4E43',
    },
    matcha: {
        '--color-bg': '#E4EBE4',        
        '--color-sidebar': '#F0F5F0',
        '--color-border': '#CBD6CB',
        '--color-text': '#0A140A',      
        '--color-dim': '#334033',
        '--color-hover': '#D6E0D6',
        '--color-accent': '#B4C6B4',
        '--color-accent-border': '#94A894',
        '--color-accent-text': '#365236',
    },
    ocean: {
        '--color-bg': '#E0E7EB',        
        '--color-sidebar': '#ECF1F4',
        '--color-border': '#C5D0D6',
        '--color-text': '#0A1117',      
        '--color-dim': '#37474F',
        '--color-hover': '#D1DBE0',
        '--color-accent': '#B0C4CC',
        '--color-accent-border': '#8D9FA8',
        '--color-accent-text': '#2C3E47',
    },
    dark: {
        '--color-bg': '#121212',
        '--color-sidebar': '#1E1E1E',
        '--color-border': '#333333',
        '--color-text': '#FFFFFF',      
        '--color-dim': '#AAAAAA',
        '--color-hover': '#2C2C2C',
        '--color-accent': '#333333',
        '--color-accent-border': '#444444',
        '--color-accent-text': '#E0E0E0',
    }
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const saved = localStorage.getItem('lifeos_state');
    return saved ? JSON.parse(saved) : initialState;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('lifeos_settings');
    // Migration logic for fontSize if it was a string
    let parsed = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    if (typeof parsed.fontSize === 'string') {
       parsed.fontSize = 14; 
    }
    return parsed;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('lifeos_chat');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Draggable Menu Button State
  const [menuPos, setMenuPos] = useState({ x: window.innerWidth - 60, y: 20 });
  const [isMenuDragging, setIsMenuDragging] = useState(false);
  const menuDragStartPos = useRef({ x: 0, y: 0 });

  // --- Theme & Font Engine ---
  useEffect(() => {
    const theme = THEMES[settings.themeId] || THEMES.sakura;
    const root = document.documentElement;
    
    // Apply Colors
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, String(value));
    });

    // Apply Font Size
    const fontSizeVal = typeof settings.fontSize === 'number' ? settings.fontSize : 14;
    root.style.setProperty('--app-font-size', `${fontSizeVal}px`);

    // Apply Custom Font
    if (settings.customFontUrl) {
       const linkId = 'lifeos-custom-font';
       let linkEl = document.getElementById(linkId) as HTMLLinkElement;
       if (!linkEl) {
           linkEl = document.createElement('link');
           linkEl.id = linkId;
           linkEl.rel = 'stylesheet';
           document.head.appendChild(linkEl);
       }
       linkEl.href = String(settings.customFontUrl);
       
       const fontUrl = String(settings.customFontUrl);
       const match = fontUrl.match(/family=([^&:]+)/);
       if (match && match[1]) {
           const fontName = match[1].replace(/\+/g, ' ');
           root.style.setProperty('--app-font', `'${fontName}', Inter, sans-serif`);
       }
    } else {
        root.style.removeProperty('--app-font');
    }

  }, [settings.themeId, settings.fontSize, settings.customFontUrl]);

  // --- Persistence ---
  useEffect(() => localStorage.setItem('lifeos_state', JSON.stringify(appState)), [appState]);
  useEffect(() => localStorage.setItem('lifeos_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('lifeos_chat', JSON.stringify(messages)), [messages]);

  // --- Drag Logic for Menu ---
  const handleMenuMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setIsMenuDragging(false);
    menuDragStartPos.current = { x: clientX, y: clientY };

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      const diffX = Math.abs(moveX - menuDragStartPos.current.x);
      const diffY = Math.abs(moveY - menuDragStartPos.current.y);

      if (diffX > 5 || diffY > 5) {
          setIsMenuDragging(true);
          setMenuPos({ x: moveX - 24, y: moveY - 24 }); // Centered
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

  const handleMenuClick = () => {
      if (!isMenuDragging) {
          setIsSidebarOpen(!isSidebarOpen);
      }
  };


  // --- Actions ---
  const addTask = (title: string, date: string, tag?: string) => {
    const newTask: Task = { id: uuidv4(), title, date, completed: false, tag };
    setAppState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    return newTask;
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setAppState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const deleteTask = (id: string) => {
    setAppState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  };

  const addNote = (content: string, type: Note['type']) => {
    const newNote: Note = { id: uuidv4(), content, type, createdAt: new Date().toISOString() };
    setAppState(prev => ({ ...prev, notes: [newNote, ...prev.notes] }));
    return newNote;
  };

  const updateNote = (id: string, content: string) => {
    setAppState(prev => ({
        ...prev,
        notes: prev.notes.map(n => n.id === id ? { ...n, content } : n)
    }));
  };

  const deleteNote = (id: string) => {
    setAppState(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }));
  };

  const updateSummary = (date: string, content: string) => {
    setAppState(prev => {
      const existing = prev.summaries.find(s => s.date === date);
      return {
        ...prev,
        summaries: existing 
          ? prev.summaries.map(s => s.date === date ? { ...s, content } : s)
          : [...prev.summaries, { date, content }]
      };
    });
  };
  
  const getActivePreset = () => settings.presets.find(p => p.id === settings.activePresetId);

  // Helper for one-off
  const callAI = async (prompt: string, tempMessages: ChatMessage[] = []) => {
      const activePreset = getActivePreset();
      if (!activePreset || !activePreset.apiKey) throw new Error("API Key missing");
      const response = await generateResponse(activePreset, settings.aiName, tempMessages, appState, prompt);
      return response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || "";
  };

  const handleGenerateSummary = async (date: string) => {
      const activePreset = getActivePreset();
      if (!activePreset || !activePreset.apiKey) { setIsSettingsOpen(true); return; }
      setIsGeneratingSummary(true);
      try {
          const prompt = `请为我生成 ${date} 的每日小结。总结任务和笔记，语气温暖。`;
          const result = await callAI(prompt);
          updateSummary(date, result);
      } catch (e) { alert("生成失败"); } finally { setIsGeneratingSummary(false); }
  };

  const handleToolExecution = (call: any) => {
    const { name, args } = call;
    if (name === 'manage_task') {
      if (args.action === 'create') {
        const t = addTask(args.title, args.date || new Date().toLocaleDateString('en-CA'), args.tag);
        return { result: "success", taskId: t.id };
      }
      if (args.action === 'update' || args.action === 'complete') {
        if (!args.id) return { error: "ID required" };
        updateTask(args.id, args.action === 'complete' ? { completed: true } : args);
        return { result: "success" };
      }
      if (args.action === 'delete') { deleteTask(args.id); return { result: "success" }; }
    }
    if (name === 'manage_note') {
       if (args.action === 'create') { const n = addNote(args.content, args.type || 'inspiration'); return { result: "success", noteId: n.id }; }
       if (args.action === 'delete') { deleteNote(args.id); return { result: "success" }; }
    }
    if (name === 'update_daily_summary') { updateSummary(args.date || new Date().toLocaleDateString('en-CA'), args.content); return { result: "success" }; }
    if (name === 'get_current_state') return { result: "State provided in system prompt." };
    return { error: "Unknown tool" };
  };

  const handleUserPost = (text: string, image?: string) => {
     const newUserMsg: ChatMessage = { id: uuidv4(), role: 'user', text, image, timestamp: Date.now() };
     setMessages(prev => [...prev, newUserMsg]);
  };

  const handleDeleteMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateMessage = (id: string, newText: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, text: newText } : m));
  };

  // Main AI Logic
  const handleTriggerAI = async (regenerate = false) => {
    const activePreset = getActivePreset();
    if (!activePreset || !activePreset.apiKey) {
      setMessages(prev => [...prev, { id: uuidv4(), role: 'system', text: '请先在系统设置中配置 API Key。', timestamp: Date.now(), isError: true }]);
      setIsSettingsOpen(true);
      return;
    }

    setIsChatLoading(true);

    try {
      const historyLimit = settings.historyLimit || 20;
      let currentMessages = [...messages];

      // Regeneration Logic
      if (regenerate) {
          // If the last message is from model/error, remove it
          if (currentMessages.length > 0) {
              const lastMsg = currentMessages[currentMessages.length - 1];
              if (lastMsg.role === 'model' || lastMsg.role === 'function' || lastMsg.role === 'system') {
                  currentMessages.pop();
                  setMessages(currentMessages); // Update UI immediately
              }
          }
      }

      const recentHistory = currentMessages.slice(-historyLimit);
      
      const response = await generateResponse(activePreset, settings.aiName, recentHistory, appState, "");
      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      
      if (!modelContent) throw new Error("No content");

      const functionCalls = modelContent.parts?.filter((p: any) => p.functionCall);

      if (functionCalls && functionCalls.length > 0) {
         // If tools are disabled, we shouldn't get here, but if we do, handle gracefully or ignore
         const toolCallMsg: ChatMessage = { id: uuidv4(), role: 'model', parts: modelContent.parts, timestamp: Date.now() };
         
         const functionResponses = functionCalls.map((part: any) => {
            const result = handleToolExecution(part.functionCall);
            return {
              functionResponse: {
                name: part.functionCall.name,
                response: { name: part.functionCall.name, content: result }
              }
            };
         });

         const toolResponseMsg: ChatMessage = {
            id: uuidv4(), role: 'function', parts: functionResponses, timestamp: Date.now()
         };

         // Recursive call for tool output
         const response2 = await generateResponse(
            activePreset, settings.aiName, 
            [...recentHistory, toolCallMsg, toolResponseMsg], 
            appState, ""
         );

         const finalParts = response2.candidates?.[0]?.content?.parts;
         const finalText = finalParts?.map((p: any) => p.text).join('') || "已处理完成。";
         
         // Split logic for multi-bubble simulation
         const bubbles = finalText.split('|||').map(s => s.trim()).filter(s => s);
         bubbles.forEach(b => {
             setMessages(prev => [...prev, { id: uuidv4(), role: 'model', text: b, timestamp: Date.now() }]);
         });

      } else {
         const textParts = modelContent.parts?.map((p: any) => p.text).join('');
         // Split logic for multi-bubble simulation
         const bubbles = textParts.split('|||').map(s => s.trim()).filter(s => s);
         bubbles.forEach(b => {
             setMessages(prev => [...prev, { id: uuidv4(), role: 'model', text: b, timestamp: Date.now() }]);
         });
      }

    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, { id: uuidv4(), role: 'system', text: `Error: ${e.message}`, timestamp: Date.now(), isError: true }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div 
        className="flex h-screen w-full font-sans overflow-hidden" 
        style={{ 
            backgroundColor: 'var(--color-bg)', 
            color: 'var(--color-text)',
            backgroundImage: settings.globalBackgroundImageUrl ? `url(${settings.globalBackgroundImageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }}
    >
      {settings.globalBackgroundImageUrl && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-0 pointer-events-none" />
      )}
      
      {/* Mobile Draggable Menu Button */}
      <div 
         className="md:hidden fixed z-40 touch-none"
         style={{ left: menuPos.x, top: menuPos.y }}
      >
          <button 
            onMouseDown={handleMenuMouseDown}
            onTouchStart={handleMenuMouseDown}
            onClick={handleMenuClick}
            className="p-3 bg-white/90 rounded-2xl shadow-float border border-notion-border text-notion-text backdrop-blur-md active:scale-95 transition-transform"
          >
            <Menu size={24} />
          </button>
      </div>

      <div className="relative z-10 flex h-full w-full">
          <Sidebar 
            currentView={currentView} 
            setView={(v) => { setCurrentView(v); setIsSidebarOpen(false); }}
            isMobile={false}
            isOpen={isSidebarOpen}
            toggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          {/* Added Shadow and Margin to create the "Card/App" feel on desktop */}
          <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-white/50 md:bg-white/40 md:rounded-l-[3rem] shadow-2xl shadow-black/5 md:my-3 md:mr-3 border border-notion-border transition-all backdrop-blur-sm">
            <div className="flex-1 overflow-hidden relative">
              {currentView === ViewMode.DASHBOARD && (
                <Dashboard 
                  state={appState} 
                  onToggleTask={(id) => { const t = appState.tasks.find(x => x.id === id); if(t) updateTask(id, { completed: !t.completed }); }}
                  onAddTask={addTask}
                  onGenerateSummary={() => handleGenerateSummary(new Date().toLocaleDateString('en-CA'))}
                  goToDailyReview={() => setCurrentView(ViewMode.DAILY_REVIEW)}
                />
              )}
              {currentView === ViewMode.DAILY_REVIEW && (
                <DailyReview 
                    summaries={appState.summaries}
                    onUpdateSummary={updateSummary}
                    onGenerateSummary={handleGenerateSummary}
                    isGenerating={isGeneratingSummary}
                />
              )}
              {currentView === ViewMode.CALENDAR && (
                <CalendarView 
                  tasks={appState.tasks} 
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  onToggleTask={(id) => { const t = appState.tasks.find(x => x.id === id); if(t) updateTask(id, { completed: !t.completed }); }}
                  onAddTask={addTask}
                  onDeleteTask={deleteTask}
                  onUpdateTask={updateTask}
                />
              )}
              {currentView === ViewMode.NOTES && (
                <NotesBoard 
                  notes={appState.notes}
                  onDeleteNote={deleteNote}
                  onAddNote={addNote}
                  onUpdateNote={updateNote}
                />
              )}
            </div>
          </main>
      </div>

      <ChatInterface 
        messages={messages} 
        onUserPost={handleUserPost}
        onTriggerAI={handleTriggerAI}
        onDeleteMessage={handleDeleteMessage}
        onUpdateMessage={handleUpdateMessage}
        isLoading={isChatLoading}
        isOpen={chatOpen}
        setIsOpen={setChatOpen}
        settings={settings}
        onUpdateSettings={setSettings}
        onClearHistory={() => setMessages([])}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
        appState={appState}
        onImportState={(newState) => { setAppState(newState); setMessages([]); }}
      />
      
    </div>
  );
}