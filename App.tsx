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
  // Modified addTask to accept optional completed status
  const addTask = (title: string, date: string, tag?: string, completed: boolean = false) => {
    const newTask: Task = { id: uuidv4(), title, date, completed, tag };
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

  const deleteSummary = (date: string) => {
      setAppState(prev => ({ ...prev, summaries: prev.summaries.filter(s => s.date !== date) }));
  };

  const handleResetData = () => {
      setAppState(initialState);
      setMessages([]);
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
          const prompt = `请为我生成 ${date} 的每日小结。总结任务和笔记，语气温暖。如果涉及更新总结，请直接使用 JSON action。`;
          const rawResult = await callAI(prompt);
          
          let finalContent = rawResult;
          
          // Parse JSON logic to avoid leakage and actually use the structured data if provided
          const jsonMatch = rawResult.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
              try {
                  const json = JSON.parse(jsonMatch[1]);
                  // Check if there is an update_summary action
                  const summaryAction = json.actions?.find((a: any) => a.type === 'update_summary');
                  
                  if (summaryAction && summaryAction.content) {
                      finalContent = summaryAction.content;
                  } else {
                      // If no specific action, just strip the JSON block from the text
                      finalContent = rawResult.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
                  }
              } catch (e) {
                  console.error("Error parsing summary JSON", e);
                  // Fallback: strip JSON regex
                  finalContent = rawResult.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
              }
          }

          // Clean up chat bubbles separators if present
          finalContent = finalContent.split('|||').join('\n').trim();

          if (finalContent) {
              updateSummary(date, finalContent);
          }
      } catch (e) { 
          alert("生成失败"); 
      } finally { 
          setIsGeneratingSummary(false); 
      }
  };

  // Agent Executor (Protocol Handler)
  const executeAgentAction = (action: any) => {
      console.log("Agent executing:", action);
      try {
          switch (action.type) {
              case 'create_task':
                  // Pass action.completed if provided
                  addTask(action.title, action.date, action.tag, action.completed || false);
                  break;
              case 'update_task':
              case 'complete_task':
                  updateTask(action.id, action.action === 'complete_task' ? { completed: true } : action);
                  break;
              case 'delete_task':
                  deleteTask(action.id);
                  break;
              case 'create_note':
                  addNote(action.content, action.noteType || 'inspiration');
                  break;
              case 'delete_note':
                  deleteNote(action.id);
                  break;
              case 'update_summary':
                  updateSummary(action.date, action.content);
                  break;
          }
      } catch (e) {
          console.error("Agent execution failed", e);
      }
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

      // Regeneration Logic: Remove ALL AI messages from the last turn
      if (regenerate) {
          let lastUserIndex = -1;
          for (let i = currentMessages.length - 1; i >= 0; i--) {
              if (currentMessages[i].role === 'user') {
                  lastUserIndex = i;
                  break;
              }
          }
          
          if (lastUserIndex !== -1) {
              // Keep messages up to and including the last user message
              currentMessages = currentMessages.slice(0, lastUserIndex + 1);
              setMessages(currentMessages); // Visual update
          }
      }

      const recentHistory = currentMessages.slice(-historyLimit);
      
      const response = await generateResponse(activePreset, settings.aiName, recentHistory, appState, "");
      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      
      if (!modelContent) throw new Error("No content");

      // Check for JSON Protocol (The Agent "Brain") inside text
      // We do this BEFORE parsing standard tools to support the "Pseudo-Tool" mode
      const rawText = modelContent.parts?.map((p: any) => p.text).join('') || "";
      
      let displayText = rawText;
      let agentActions: any[] = [];

      // Regex to find JSON blocks: ```json ... ```
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch) {
          try {
              const jsonContent = JSON.parse(jsonMatch[1]);
              if (jsonContent.actions && Array.isArray(jsonContent.actions)) {
                  agentActions = jsonContent.actions;
                  
                  // Execute Agent Actions
                  agentActions.forEach(action => executeAgentAction(action));

                  // Clean the text for display (Remove the JSON block)
                  displayText = rawText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
                  
                  // If text is empty after removing JSON, add a fallback "Done" message
                  if (!displayText) {
                      displayText = "已为您更新日程。";
                  }
              }
          } catch (e) {
              console.error("Failed to parse Agent JSON", e);
          }
      }

      // Display the cleaned text bubbles
      const bubbles = displayText.split('|||').map(s => s.trim()).filter(s => s);
      bubbles.forEach(b => {
             setMessages(prev => [...prev, { id: uuidv4(), role: 'model', text: b, timestamp: Date.now() }]);
      });

    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, { id: uuidv4(), role: 'system', text: `Error: ${e.message}`, timestamp: Date.now(), isError: true }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div 
        className={`flex h-screen w-full font-sans overflow-hidden ${settings.globalBackgroundImageUrl ? 'has-custom-bg' : ''}`} 
        style={{ 
            backgroundColor: 'var(--color-bg)', 
            color: 'var(--color-text)',
            backgroundImage: settings.globalBackgroundImageUrl ? `url(${settings.globalBackgroundImageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }}
    >
      {/* 1. Adjusted Overlay: Less blur, more transparent white */}
      {settings.globalBackgroundImageUrl && (
          <div className="absolute inset-0 bg-white/30 backdrop-blur-sm z-0 pointer-events-none" />
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
                    onDeleteSummary={deleteSummary}
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
        onResetData={handleResetData}
      />
      
    </div>
  );
}