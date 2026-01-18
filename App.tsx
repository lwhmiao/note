
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { CalendarView } from './components/CalendarView';
import { NotesBoard } from './components/NotesBoard';
import { Dashboard } from './components/Dashboard';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { DailyReview } from './components/DailyReview';
import { PlanBoard } from './components/PlanBoard';
import { AppState, ViewMode, Task, Note, ChatMessage, AppSettings, DEFAULT_SETTINGS, ThemeId, BacklogTask, Quadrant, TaskType } from './types';
import { generateResponse } from './services/llm';
import { Menu } from 'lucide-react';

const initialState: AppState = {
  tasks: [],
  notes: [],
  summaries: [],
  backlogTasks: []
};

const DEFAULT_QUOTES = [
    "今天也是充满可能的一天 (ง •_•)ง",
    "慢慢来，比较快 (｡♥‿♥｡)",
    "保持热爱，奔赴山海 ✨",
    "生活明朗，万物可爱 🌈",
    "咸鱼翻身... 还是咸鱼 _(:з」∠)_",
    "间歇性踌躇满志，持续性混吃等死 🌚",
    "允许一切发生，拥抱每一个当下 🌿",
    "虽然辛苦，但我还是会选择那种滚烫的人生 🔥"
];

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
        '--color-text': '#E0E0E0',      
        '--color-dim': '#B0B0B0', 
        '--color-hover': '#333333',
        '--color-accent': '#2C2C2C', 
        '--color-accent-border': '#444444',
        '--color-accent-text': '#E0E0E0', // Gray-ish white, easier on eyes than pure white
    }
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const saved = localStorage.getItem('lifeos_state');
    const loaded = saved ? JSON.parse(saved) : initialState;
    if (!loaded.backlogTasks) loaded.backlogTasks = [];
    return loaded;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('lifeos_settings');
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
  
  const [quoteStr, setQuoteStr] = useState<string>(() => {
      const saved = localStorage.getItem('lifeos_quote');
      if (saved) return saved;
      return DEFAULT_QUOTES[Math.floor(Math.random() * DEFAULT_QUOTES.length)];
  });

  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [menuPos, setMenuPos] = useState({ x: window.innerWidth - 60, y: 90 });
  const [isMenuDragging, setIsMenuDragging] = useState(false);
  const menuDragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const theme = THEMES[settings.themeId] || THEMES.sakura;
    const root = document.documentElement;
    
    // Toggle dark mode class on HTML element for Tailwind dark: prefix support
    if (settings.themeId === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, String(value));
    });
    const fontSizeVal = typeof settings.fontSize === 'number' ? settings.fontSize : 14;
    root.style.setProperty('--app-font-size', `${fontSizeVal}px`);

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

  useEffect(() => localStorage.setItem('lifeos_state', JSON.stringify(appState)), [appState]);
  useEffect(() => localStorage.setItem('lifeos_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('lifeos_chat', JSON.stringify(messages)), [messages]);

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
          setMenuPos({ x: moveX - 24, y: moveY - 24 });
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

  const handleFullImport = (data: any) => {
     if (data.data) setAppState(data.data);
     if (data.settings) setSettings(data.settings);
     if (data.chat) setMessages(data.chat);
     if (data.quote) setQuoteStr(data.quote);
  };

  // --- Task Logic ---
  const addTask = (title: string, date: string, tag?: string, completed: boolean = false): Task | null => {
    // Check for duplicates
    if (appState.tasks.some(t => t.date === date && t.title.trim() === title.trim())) {
        return null;
    }
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

  // --- Note Logic ---
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

  // --- Summary Logic ---
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

  // --- Backlog/PlanBoard Logic ---
  const addBacklogTask = (title: string, quadrant: Quadrant, type: TaskType) => {
      const newTask: BacklogTask = { id: uuidv4(), title, quadrant, type, createdAt: new Date().toISOString() };
      setAppState(prev => ({ ...prev, backlogTasks: [...prev.backlogTasks, newTask] }));
  };

  const updateBacklogTask = (id: string, updates: Partial<BacklogTask>) => {
      setAppState(prev => ({
          ...prev,
          backlogTasks: prev.backlogTasks.map(t => t.id === id ? { ...t, ...updates } : t)
      }));
  };

  const deleteBacklogTask = (id: string) => {
      setAppState(prev => ({ ...prev, backlogTasks: prev.backlogTasks.filter(t => t.id !== id) }));
  };

  const scheduleBacklogTask = (task: BacklogTask, startDateStr: string, endDateStr?: string) => {
      if (task.type === 'once') {
          // Schedule once
          const result = addTask(task.title, startDateStr, '计划', false);
          if (result) {
            deleteBacklogTask(task.id);
          } else {
            alert(`该日已存在 "${task.title}"，请勿重复添加！`);
          }
      } else if (task.type === 'longterm' && endDateStr) {
          // Schedule range
          const start = new Date(startDateStr);
          const end = new Date(endDateStr);
          const newTasks: Task[] = [];
          
          for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
              // Local ISO YYYY-MM-DD
              const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              // Pre-check for duplicate in current state to prevent duplicates in DB
              if (!appState.tasks.some(t => t.date === dateStr && t.title === task.title)) {
                newTasks.push({
                    id: uuidv4(),
                    title: task.title,
                    date: dateStr,
                    completed: false,
                    tag: '计划'
                });
              }
          }

          if (newTasks.length > 0) {
              setAppState(prev => ({ ...prev, tasks: [...prev.tasks, ...newTasks] }));
              alert(`已成功添加 ${newTasks.length} 个日程。`);
          } else {
              alert("所选范围内所有日程均已存在。");
          }
          // Do NOT delete backlog task
      }
  };

  const handleResetData = () => {
      setAppState(initialState);
      setMessages([]);
      setQuoteStr(DEFAULT_QUOTES[0]);
      localStorage.removeItem('lifeos_quote');
  };
  
  const getActivePreset = () => settings.presets.find(p => p.id === settings.activePresetId);

  const callAI = async (prompt: string, tempMessages: ChatMessage[] = []) => {
      const activePreset = getActivePreset();
      if (!activePreset || !activePreset.apiKey) throw new Error("API Key missing");
      const generateResponse = await import('./services/llm').then(m => m.generateResponse);
      const response = await generateResponse(activePreset, settings.aiName, tempMessages, appState, prompt);
      return response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || "";
  };

  const handleRefreshQuote = async () => {
      try {
          const prompt = "请生成一句简短（30字以内）的中文语录，带上颜文字或Emoji。重要：请直接返回语录文本，不要包含任何寒暄、前缀或后缀，不要使用 '|||' 分隔符。";
          const result = await callAI(prompt);
          let cleanQuote = result.replace(/```.*?```/g, '').trim(); 
          
          if (cleanQuote.includes('|||')) {
              const parts = cleanQuote.split('|||').map(p => p.trim());
              const quotedPart = parts.find(p => /^["'“].*["'”]$/.test(p));
              if (quotedPart) {
                  cleanQuote = quotedPart;
              } else {
                  // Fallback: Pick the part that doesn't look like a conversational filler
                  const contentParts = parts.filter(p => !/^(好的|没问题|当然|为您|希望|这里|这是)/.test(p));
                  cleanQuote = contentParts.length > 0 ? contentParts[0] : parts[0];
              }
          }

          // Clean up outer quotes
          cleanQuote = cleanQuote.replace(/^["'“](.*)["'”]$/, '$1');

          setQuoteStr(cleanQuote);
          localStorage.setItem('lifeos_quote', cleanQuote);
      } catch (e) {
          const fallback = DEFAULT_QUOTES[Math.floor(Math.random() * DEFAULT_QUOTES.length)];
          setQuoteStr(fallback);
      }
  };

  const handleGenerateSummary = async (date: string) => {
      const activePreset = getActivePreset();
      if (!activePreset || !activePreset.apiKey) { setIsSettingsOpen(true); return; }
      setIsGeneratingSummary(true);
      try {
          const prompt = `请为我生成 ${date} 的每日小结。总结任务和笔记，语气温暖。字数100-150字。`;
          const rawResult = await callAI(prompt);
          let finalContent = rawResult;
          const jsonMatch = rawResult.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
              try {
                  const json = JSON.parse(jsonMatch[1]);
                  const summaryAction = json.actions?.find((a: any) => a.type === 'update_summary');
                  if (summaryAction && summaryAction.content) finalContent = summaryAction.content;
                  else finalContent = rawResult.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
              } catch (e) {
                  finalContent = rawResult.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
              }
          }
          finalContent = finalContent.split('|||').join('\n').trim();
          if (finalContent) updateSummary(date, finalContent);
      } catch (e) { 
          alert("生成失败"); 
      } finally { 
          setIsGeneratingSummary(false); 
      }
  };

  const executeAgentAction = (action: any): string | null => {
      console.log("Agent executing:", action);
      try {
          switch (action.type) {
              case 'create_task':
                  const t = addTask(action.title, action.date, action.tag, action.completed || false);
                  if (!t) return `💡 任务 "${action.title}" 在 ${action.date} 已存在，不再重复添加。`;
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
              // New Backlog Actions
              case 'create_backlog_task':
                  addBacklogTask(action.title, action.quadrant || Quadrant.Q2, action.taskType || 'once');
                  break;
              case 'delete_backlog_task':
                  deleteBacklogTask(action.id);
                  break;
              case 'update_backlog_task':
                  updateBacklogTask(action.id, action);
                  break;
          }
      } catch (e) {
          console.error("Agent execution failed", e);
      }
      return null;
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

      if (regenerate) {
          let lastUserIndex = -1;
          for (let i = currentMessages.length - 1; i >= 0; i--) {
              if (currentMessages[i].role === 'user') {
                  lastUserIndex = i;
                  break;
              }
          }
          if (lastUserIndex !== -1) {
              currentMessages = currentMessages.slice(0, lastUserIndex + 1);
              setMessages(currentMessages);
          }
      }

      const recentHistory = currentMessages.slice(-historyLimit);
      const response = await generateResponse(activePreset, settings.aiName, recentHistory, appState, "");
      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      
      if (!modelContent) throw new Error("No content");

      const rawText = modelContent.parts?.map((p: any) => p.text).join('') || "";
      let displayText = rawText;
      let agentActions: any[] = [];
      const feedbackMsgs: string[] = [];
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch) {
          try {
              const jsonContent = JSON.parse(jsonMatch[1]);
              if (jsonContent.actions && Array.isArray(jsonContent.actions)) {
                  agentActions = jsonContent.actions;
                  agentActions.forEach(action => {
                      const fb = executeAgentAction(action);
                      if (fb) feedbackMsgs.push(fb);
                  });
                  displayText = rawText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
                  if (!displayText) displayText = "已为您更新数据。";
              }
          } catch (e) {
              console.error("Failed to parse Agent JSON", e);
          }
      }

      const bubbles = displayText.split('|||').map(s => s.trim()).filter(s => s);
      if (bubbles.length > 0) await new Promise(resolve => setTimeout(resolve, 400));

      for (let i = 0; i < bubbles.length; i++) {
          setMessages(prev => [...prev, { id: uuidv4(), role: 'model', text: bubbles[i], timestamp: Date.now() }]);
          if (i < bubbles.length - 1) {
              const delay = 800 + Math.random() * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
          }
      }

      if (feedbackMsgs.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 600));
          setMessages(prev => [...prev, { id: uuidv4(), role: 'model', text: feedbackMsgs.join('\n'), timestamp: Date.now() }]);
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
        className={`flex h-screen w-full font-sans overflow-hidden ${settings.globalBackgroundImageUrl ? 'has-custom-bg' : ''}`} 
        style={{ 
            backgroundColor: 'var(--color-bg)', 
            color: 'var(--color-text)',
            // Only show background image if NOT in dark mode
            backgroundImage: (settings.themeId !== 'dark' && settings.globalBackgroundImageUrl) ? `url(${settings.globalBackgroundImageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }}
    >
      {/* Only show overlay texture/blur if image is present AND not dark mode */}
      {(settings.themeId !== 'dark' && settings.globalBackgroundImageUrl) && (
          <div className="absolute inset-0 bg-white/30 backdrop-blur-sm z-0 pointer-events-none" />
      )}
      
      {/* Mobile Menu Button */}
      <div 
         className="md:hidden fixed z-40 touch-none"
         style={{ left: menuPos.x, top: menuPos.y }}
      >
          <button 
            onMouseDown={handleMenuMouseDown}
            onTouchStart={handleMenuMouseDown}
            onClick={handleMenuClick}
            className="p-3 bg-notion-sidebar/90 rounded-2xl shadow-float border border-notion-border text-notion-text backdrop-blur-md active:scale-95 transition-transform"
          >
            <Menu size={24} />
          </button>
      </div>
      
      {/* Overlay for Mobile Sidebar */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-30 bg-transparent md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      <div className="relative flex h-full w-full">
          <Sidebar 
            currentView={currentView} 
            setView={(v) => { setCurrentView(v); setIsSidebarOpen(false); }}
            isMobile={false}
            isOpen={isSidebarOpen}
            toggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-notion-sidebar/50 md:bg-notion-sidebar/40 md:rounded-l-[3rem] shadow-2xl shadow-black/5 md:my-3 md:mr-3 border border-notion-border transition-all backdrop-blur-sm">
            <div className="flex-1 overflow-hidden relative">
              {currentView === ViewMode.DASHBOARD && (
                <Dashboard 
                  state={appState} 
                  onToggleTask={(id) => { const t = appState.tasks.find(x => x.id === id); if(t) updateTask(id, { completed: !t.completed }); }}
                  onAddTask={addTask}
                  onGenerateSummary={() => handleGenerateSummary(new Date().toLocaleDateString('en-CA'))}
                  quoteStr={quoteStr}
                  onRefreshQuote={handleRefreshQuote}
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
              {currentView === ViewMode.PLAN_BOARD && (
                  <PlanBoard
                    tasks={appState.backlogTasks}
                    onAddBacklogTask={addBacklogTask}
                    onUpdateBacklogTask={updateBacklogTask}
                    onDeleteBacklogTask={deleteBacklogTask}
                    onScheduleTask={scheduleBacklogTask}
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
        onImportFullData={handleFullImport}
        onResetData={handleResetData}
        currentMessages={messages}
        currentQuote={quoteStr}
      />
      
    </div>
  );
}
