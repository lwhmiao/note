
import React, { useState, useMemo, useEffect } from 'react';
import { HealthState, HealthLog, HealthMode } from '../types';
import { Sparkles, Activity, ChevronLeft, ChevronRight, X, Droplets, Zap, Smile, Heart, Thermometer, Baby, ChevronDown, Clock, HeartHandshake, Shield } from 'lucide-react';

interface HealthBoardProps {
  state: HealthState;
  onUpdateLog: (log: HealthLog) => void;
  onUpdateMode: (mode: HealthMode) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const toLocalDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const MODES: Record<HealthMode, string> = {
    'self_care': '自在模式',
    'ttc': '备孕模式',
    'pregnancy': '孕期模式'
};

// --- Refined Morandi Palette ---
const PHASE_STYLES: Record<string, string> = {
    // Self Care (Base Palette)
    'menstrual': 'bg-[#EBCBCB] text-[#7A3E3E] font-medium border border-[#D6B5B5]', // Muted Red/Pink
    'follicular': 'bg-[#D8E6E2] text-[#2F5246] font-normal border border-[#BCCFC9]', // Sage Green
    'ovulation': 'bg-[#F0E5D0] text-[#6B5628] font-medium border border-[#E0D4BC]', // Muted Sand/Gold
    'luteal': 'bg-[#E2E2E6] text-[#4A4A57] font-normal border border-[#CFCDD6]',     // Cool Gray/Lavender
    
    // TTC specific overrides (Mapped to Self Care as requested)
    'ttc_stable': 'bg-[#D8E6E2] text-[#2F5246] font-normal border border-[#BCCFC9]', // Map to Follicular (Sage Green)
    'ttc_waiting': 'bg-[#E2E2E6] text-[#4A4A57] font-normal border border-[#CFCDD6]', // Map to Luteal (Cool Gray)
    'ttc_high': 'bg-[#F0E5D0] text-[#6B5628] font-medium border border-[#E0D4BC]', // Map to Ovulation (Sand/Gold)
    
    // TTC Special
    'ttc_peak': 'bg-[#E0D6F0] text-[#5D4B75] font-bold border border-[#C8BEDE] ring-1 ring-[#C8BEDE]', // KEEP Purple for Ovulation Day
    
    // Default Empty
    'default': 'bg-white/60 dark:bg-notion-bg text-notion-text hover:bg-white/80'
};

const SYMPTOMS_LIST = ['无痛', '轻微腹痛', '严重痛经', '腰酸', '头痛', '胸胀', '失眠', '食欲大增', '恶心', '疲劳'];
const MOOD_LIST = ['😊 开心', '😐 平静', '😫 疲惫', '😡 易怒', '😢 难过', '🤯 焦虑'];
const PROTECTION_LIST = ['无措施', '安全套', '避孕药', '外射', '其他'];

export const HealthBoard: React.FC<HealthBoardProps> = ({ state, onUpdateLog, onUpdateMode, onAnalyze, isAnalyzing }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState(5); // Default period duration
  
  // Log Modal State
  const [editingLog, setEditingLog] = useState<HealthLog | null>(null);

  // Load default duration from local storage on mount
  useEffect(() => {
      const saved = localStorage.getItem('lifeos_period_duration');
      if (saved) setDefaultDuration(parseInt(saved));
  }, []);

  const todayStr = toLocalDateStr(new Date());
  const logMap = useMemo(() => {
      const map: Record<string, HealthLog> = {};
      state.logs.forEach(l => map[l.date] = l);
      return map;
  }, [state.logs]);

  // Memoize sorted logs to avoid resort on every cell render
  const allStartLogs = useMemo(() => {
    return state.logs
        .filter(l => l.isPeriodStart)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.logs]);

  const earliestLogDate = useMemo(() => {
      if (allStartLogs.length > 0) {
          // Since it's sorted Descending (Newest first), the last one is the earliest
          return new Date(allStartLogs[allStartLogs.length - 1].date);
      }
      if (state.analysis.lastPeriodDate) {
          return new Date(state.analysis.lastPeriodDate);
      }
      return null;
  }, [allStartLogs, state.analysis.lastPeriodDate]);

  // --- Robust Calendar Phase Logic ---
  // Returns styling config AND calculated cycle info
  const calculatePhase = (dateStr: string) => {
      const targetDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const isFuture = targetDate > today;
      const isToday = toLocalDateStr(targetDate) === toLocalDateStr(today);

      // 1. ACTUAL LOGGED PERIODS (Highest Priority - Solid Color)
      const activePeriodLog = state.logs.find(l => {
          if (!l.isPeriodStart) return false;
          const startDate = new Date(l.date);
          const duration = l.duration || 5;
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + duration - 1);
          return targetDate >= startDate && targetDate <= endDate;
      });

      if (activePeriodLog) {
           // Calculate which day of period this is (1-based)
           const dayOfPeriod = Math.floor((targetDate.getTime() - new Date(activePeriodLog.date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
           return { style: PHASE_STYLES['menstrual'], label: '月经期', opacityClass: 'opacity-100', isPredicted: false, dayInCycle: null, dayInPhase: dayOfPeriod };
      }
      
      const log = logMap[dateStr];
      if (log?.flow || log?.flowLevel) {
           return { style: PHASE_STYLES['menstrual'], label: '月经期', opacityClass: 'opacity-100', isPredicted: false, dayInCycle: null, dayInPhase: null };
      }

      // Requirement: If analysis has NOT run, show NO predictions.
      if (state.analysis.currentPhase === '需分析') {
           return { style: PHASE_STYLES['default'], opacityClass: 'opacity-100', label: null, dayInCycle: null, isPredicted: false, dayInPhase: null };
      }

      // 2. CHECK PRE-HISTORY
      if (earliestLogDate && targetDate < earliestLogDate) {
           return { style: PHASE_STYLES['default'], opacityClass: 'opacity-100', label: null, dayInCycle: null, isPredicted: false, dayInPhase: null };
      }
      if (!earliestLogDate) {
           return { style: PHASE_STYLES['default'], opacityClass: 'opacity-100', label: null, dayInCycle: null, isPredicted: false, dayInPhase: null };
      }
      
      const { analysis } = state;
      const cycleLen = analysis.cycleLength || 28;
      
      // FIX 3: Prioritize the duration of the MOST RECENT LOG over the AI/default.
      const lastLog = allStartLogs[0];
      const periodLen = lastLog?.duration || analysis.periodLength || 5;

      // 3. FIND ANCHOR (Closest Past Log)
      const anchorLog = allStartLogs.find(l => new Date(l.date) <= targetDate);
      let anchorDate: Date;

      if (anchorLog) {
          anchorDate = new Date(anchorLog.date);
      } else {
          anchorDate = earliestLogDate;
      }

      // 4. CALCULATE PHASE
      const diffTime = targetDate.getTime() - anchorDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Calculate Day In Cycle (1-based)
      let cycleDay = ((diffDays % cycleLen) + cycleLen) % cycleLen + 1;
      
      // FIX 1 & 2: HANDLE OVERDUE / GAPS
      let effectiveCycleDay = cycleDay;
      let isOverdue = false;

      if (!isFuture) {
          if (anchorLog) {
             const daysSinceLastRealPeriod = Math.floor((targetDate.getTime() - new Date(anchorLog.date).getTime()) / (1000 * 60 * 60 * 24));
             if (daysSinceLastRealPeriod >= cycleLen) {
                 isOverdue = true;
                 effectiveCycleDay = daysSinceLastRealPeriod + 1; // e.g. Day 29, 30...
             }
          }
      }

      // Opacity Logic
      let opacity = 'opacity-70';
      if (isFuture) {
          opacity = 'opacity-35';
      } else if (diffDays >= cycleLen && !isOverdue) {
          opacity = 'opacity-35';
      }
      
      // Pass isOverdue to style selector
      const config = getPhaseStyleForDay(effectiveCycleDay, periodLen, cycleLen, state.mode, opacity, isOverdue);
      
      // FIX 2 (Cont): Ensure "Predicted" logic doesn't override real life
      if (config.label === '月经期' && isFuture) {
          return { ...config, isPredicted: true, dayInCycle: effectiveCycleDay };
      }

      return { ...config, dayInCycle: effectiveCycleDay, isPredicted: false };
  };

  const getPhaseStyleForDay = (day: number, pLen: number, cLen: number, mode: HealthMode, opacity: string, isOverdue: boolean) => {
      // Define Ranges
      const ovulationDay = cLen - 14; // e.g. Day 14
      const fertileStart = ovulationDay - 5; // e.g. Day 9
      const fertileEnd = ovulationDay + 1; // e.g. Day 15

      // FIX 1: Handle Overdue/Late Days (Day > CycleLength)
      if (isOverdue || day > cLen) {
           const label = mode === 'ttc' ? '等待期' : '守护期'; // Or "推迟"
           const style = mode === 'ttc' ? PHASE_STYLES['ttc_waiting'] : PHASE_STYLES['luteal'];
           // Phase Day for overdue is continuous count from end of fertile window or just cycle day - fertile end
           const phaseDay = day - fertileEnd;
           return { style, label, opacityClass: opacity, phaseDay };
      }

      // Standard Cycle Logic
      // Self-Care
      if (mode === 'self_care') {
          if (day <= pLen) {
             return { style: PHASE_STYLES['menstrual'], label: '月经期', opacityClass: opacity, phaseDay: day };
          }
          if (day >= fertileStart && day <= fertileEnd) {
             return { style: PHASE_STYLES['ovulation'], label: '高能期', opacityClass: opacity, phaseDay: day - fertileStart + 1 };
          }
          if (day > pLen && day < fertileStart) {
             return { style: PHASE_STYLES['follicular'], label: '复苏期', opacityClass: opacity, phaseDay: day - pLen };
          }
          // Luteal
          return { style: PHASE_STYLES['luteal'], label: '守护期', opacityClass: opacity, phaseDay: day - fertileEnd }; 
      }
      
      // TTC
      if (mode === 'ttc') {
          // 1. Period
          if (day <= pLen) {
              return { style: PHASE_STYLES['menstrual'], label: '月经期', opacityClass: opacity, phaseDay: day };
          }
          
          // 2. Stable (Follicular equivalent)
          if (day > pLen && day < fertileStart) {
              return { style: PHASE_STYLES['ttc_stable'], label: '平稳期', opacityClass: opacity, phaseDay: day - pLen };
          }
          
          // 3. Fertile Window
          if (day >= fertileStart && day <= fertileEnd) {
              if (day === ovulationDay) {
                  return { style: PHASE_STYLES['ttc_peak'], label: '排卵日', opacityClass: opacity, phaseDay: day - fertileStart + 1 };
              }
              return { style: PHASE_STYLES['ttc_high'], label: '易孕期', opacityClass: opacity, phaseDay: day - fertileStart + 1 };
          }
          
          // 4. Waiting (Luteal equivalent)
          return { style: PHASE_STYLES['ttc_waiting'], label: '等待期', opacityClass: opacity, phaseDay: day - fertileEnd };
      }
      
      return { style: PHASE_STYLES['default'], opacityClass: 'opacity-100', phaseDay: null };
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const openLogModal = (dateStr: string) => {
      // FIX 2: Security check, although button is disabled in render
      const target = new Date(dateStr);
      target.setHours(0,0,0,0);
      const now = new Date();
      now.setHours(0,0,0,0);
      if (target > now) return;

      setSelectedDateStr(dateStr);
      setEditingLog(logMap[dateStr] || { 
          date: dateStr, 
          flowLevel: 0, 
          duration: defaultDuration 
      });
  };

  const saveLog = () => {
      if (editingLog) {
          // Update default duration if period start
          if (editingLog.isPeriodStart && editingLog.duration) {
              setDefaultDuration(editingLog.duration);
              localStorage.setItem('lifeos_period_duration', editingLog.duration.toString());
          }
          onUpdateLog(editingLog);
          setSelectedDateStr(null);
          setEditingLog(null);
      }
  };

  // --- Calculated Display State (Dashboard) ---
  const todayCalculated = calculatePhase(todayStr);
  const isTodayLogged = logMap[todayStr]?.isPeriodStart || logMap[todayStr]?.flow;
  
  // FIX: Prioritize Calendar Calculation over AI Stale Data
  // This ensures the header matches the calendar grid
  let displayPhaseLabel = todayCalculated.label;
  
  if (state.mode === 'pregnancy') {
      displayPhaseLabel = '孕期';
  } else if (!displayPhaseLabel) {
       // Only fallback to AI analysis if local calc failed (rare)
      if (state.analysis.currentPhase && state.analysis.currentPhase !== '需分析') {
         displayPhaseLabel = state.analysis.currentPhase;
      } else {
         displayPhaseLabel = "等待分析";
      }

      // Fallback for gaps
      if (displayPhaseLabel === '等待分析' && !isTodayLogged && !todayCalculated.label && !todayCalculated.isPredicted) {
          displayPhaseLabel = state.mode === 'ttc' ? '等待期' : '守护期';
      }
  }

  // MODIFIED: Removed Day X info as requested
  const displayDayInfo = null;
  
  // Detect Stale AI Advice
  const isAdviceStale = state.analysis.currentPhase && 
                        displayPhaseLabel && 
                        state.analysis.currentPhase !== displayPhaseLabel && 
                        state.mode !== 'pregnancy' && 
                        displayPhaseLabel !== '等待分析';

  // --- Calendar Grid ---
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => {
    const d = [];
    for (let i = 0; i < firstDayOfMonth; i++) d.push(null);
    for (let i = 1; i <= daysInMonth; i++) d.push(new Date(year, month, i));
    return d;
  }, [year, month, daysInMonth, firstDayOfMonth]);


  return (
    <div className="h-full bg-texture relative overflow-y-auto overflow-x-hidden">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      
        {/* --- Top Dashboard Card --- */}
        <div className="bg-white/80 dark:bg-notion-sidebar rounded-3xl border border-notion-border shadow-soft p-5 md:p-6 relative overflow-visible transition-colors">
              {/* Decoration */}
              <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none overflow-hidden">
                 {state.mode === 'pregnancy' ? <Baby size={200}/> : <Activity size={200}/>}
              </div>

              {/* Header: Title Left, Controls Right */}
              <div className="flex flex-row justify-between items-center gap-4 z-10 relative mb-6">
                  {/* Left: Status */}
                  <div>
                      <h2 className="text-[10px] font-bold text-notion-dim uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <Activity size={12}/> 身心观测站
                      </h2>
                      <div className="flex items-baseline gap-2">
                          <h1 className="text-2xl font-display font-bold text-notion-text tracking-tight">
                              {displayPhaseLabel}
                          </h1>
                          
                          {/* Only show Day X if we have a valid calculated phase */}
                          {displayDayInfo && state.mode !== 'pregnancy' && (
                              <span className="px-2 py-0.5 rounded-full bg-notion-accentText/10 text-notion-accentText text-xs font-bold border border-notion-accentText/20">
                                  {displayDayInfo}
                              </span>
                          )}
                           {state.mode === 'pregnancy' && state.analysis.pregnancyWeek && (
                              <span className="text-lg text-notion-accentText font-medium">
                                  孕 {state.analysis.pregnancyWeek}周+{state.analysis.pregnancyDay}
                              </span>
                          )}
                      </div>
                  </div>
                  
                  {/* Right: Controls */}
                  <div className="flex gap-2 items-center relative z-50">
                      <div className="relative">
                          <button 
                            onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                            className="flex items-center justify-center gap-1.5 w-24 px-1 py-1.5 bg-white dark:bg-notion-bg border border-notion-border rounded-lg text-xs font-bold text-notion-text shadow-sm hover:border-notion-accentText transition-all"
                          >
                              {MODES[state.mode]} <ChevronDown size={12} className="text-notion-dim"/>
                          </button>
                          {isModeMenuOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsModeMenuOpen(false)}/>
                                <div className="absolute top-full right-0 mt-1 w-24 bg-white dark:bg-notion-bg rounded-xl shadow-xl border border-notion-border z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    {Object.entries(MODES).map(([k, v]) => (
                                        <button
                                            key={k}
                                            onClick={() => { onUpdateMode(k as HealthMode); setIsModeMenuOpen(false); }}
                                            className={`w-full text-center px-2 py-2 text-xs font-medium hover:bg-notion-hover transition-colors ${state.mode === k ? 'text-notion-accentText bg-notion-sidebar' : 'text-notion-text'}`}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                              </>
                          )}
                      </div>
                      
                      <button 
                         onClick={onAnalyze}
                         disabled={isAnalyzing}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-notion-accentText text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-md shadow-pink-200/50"
                      >
                          {isAnalyzing ? <Sparkles size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                          AI 分析
                      </button>
                  </div>
              </div>

              {/* Stats & Advice Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-0">
                  <div className="bg-white/50 dark:bg-notion-bg/30 rounded-xl p-5 border border-notion-border backdrop-blur-sm flex gap-4 items-start">
                      <div className="p-2.5 bg-notion-accent/30 rounded-full h-fit text-notion-accentText mt-0.5">
                          <Sparkles size={18}/>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-notion-dim uppercase mb-2">AI 建议 ({displayPhaseLabel})</h4>
                          <p className="text-sm text-notion-text leading-relaxed font-medium">
                              {isAdviceStale 
                                  ? "检测到周期状态更新，请点击右上角「AI 分析」获取最新建议。" 
                                  : (state.analysis.advice || "记录经期并点击分析，获取针对当前阶段的专属建议。")
                              }
                          </p>
                      </div>
                  </div>
                  
                  <div className="bg-white/50 dark:bg-notion-bg/30 rounded-xl p-5 border border-notion-border backdrop-blur-sm flex flex-col justify-center items-center text-center">
                       {state.mode === 'ttc' ? (
                           <>
                               <span className="text-xs text-notion-dim uppercase font-bold mb-1">今日受孕几率</span>
                               <span className="text-3xl font-bold text-notion-accentText tracking-tight">{state.analysis.conceptionChance || "-"}</span>
                           </>
                       ) : state.mode === 'pregnancy' ? (
                           <>
                               <span className="text-xs text-notion-dim uppercase font-bold mb-1">宝宝状态</span>
                               <span className="text-2xl font-bold text-notion-accentText">{state.analysis.babySize || "未知"}</span>
                           </>
                       ) : (
                           <>
                               <span className="text-xs text-notion-dim uppercase font-bold mb-1">下一次经期预测</span>
                               {state.analysis.nextPeriodDate ? (
                                   <>
                                     <span className="text-2xl font-bold text-notion-text">
                                         {new Date(state.analysis.nextPeriodDate).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric'})}
                                     </span>
                                     <span className="text-xs text-notion-dim bg-notion-sidebar px-2 py-0.5 rounded mt-1">
                                        {(() => {
                                            const today = new Date();
                                            today.setHours(0,0,0,0);
                                            const next = new Date(state.analysis.nextPeriodDate);
                                            next.setHours(0,0,0,0);
                                            const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 3600 * 24));
                                            
                                            if (diff === 0) return "预计今天";
                                            return diff < 0 ? `推迟 ${Math.abs(diff)} 天` : `还有 ${diff} 天`;
                                        })()}
                                     </span>
                                   </>
                               ) : (
                                   <span className="text-xl font-bold text-notion-dim">--</span>
                               )}
                           </>
                       )}
                  </div>
              </div>
        </div>

        {/* --- Calendar Section --- */}
        <div className="bg-white/80 dark:bg-notion-sidebar rounded-3xl border border-notion-border p-5 md:p-6 shadow-soft transition-colors z-0">
            {/* Calendar Controls */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-display font-bold text-notion-text">{year}年 {month + 1}月</h3>
                    <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-bold px-2 py-1 bg-notion-hover rounded text-notion-text hover:bg-notion-dim/20 transition-colors">今天</button>
                </div>
                <div className="flex gap-0.5 bg-notion-bg p-0.5 rounded-lg border border-notion-border">
                    <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-notion-hover rounded text-notion-dim transition-colors"><ChevronLeft size={16}/></button>
                    <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-notion-hover rounded text-notion-dim transition-colors"><ChevronRight size={16}/></button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-2 mb-2">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="text-center text-xs font-bold text-notion-dim mb-2 uppercase tracking-wider">{d}</div>
                ))}
                
                {days.map((date, idx) => {
                    if (!date) return <div key={`pad-${idx}`} className="h-14 md:h-24 rounded-xl bg-transparent" />;
                    
                    const dateStr = toLocalDateStr(date);
                    const isToday = dateStr === todayStr;
                    const log = logMap[dateStr];
                    const phaseConfig = calculatePhase(dateStr);
                    const isFuture = new Date(dateStr) > new Date(todayStr);

                    return (
                        <div 
                            key={dateStr}
                            onClick={() => !isFuture && openLogModal(dateStr)}
                            className={`
                                relative h-14 md:h-24 rounded-xl p-2 border transition-all flex flex-col justify-between group
                                ${phaseConfig.style}
                                ${isFuture ? 'cursor-not-allowed border-dashed opacity-50' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'}
                                ${isToday ? 'ring-2 ring-notion-text ring-offset-2' : ''}
                                ${log ? 'shadow-sm' : ''}
                                ${phaseConfig.opacityClass}
                            `}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-notion-text text-notion-bg' : ''}`}>
                                    {date.getDate()}
                                </span>
                                {log?.isPeriodStart && (
                                    <div className="p-1 bg-white/30 rounded-full" title="经期开始">
                                        <Droplets size={12} className="text-red-700 fill-current"/>
                                    </div>
                                )}
                            </div>
                            
                            {/* Content removed to reduce clutter and height */}
                            <div className="space-y-1">
                                <div className="flex flex-wrap gap-1 justify-end">
                                    {log?.symptoms && log.symptoms.length > 0 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" title="症状"/>
                                    )}
                                    {log?.sexualActivity && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500" title="同房"/>
                                    )}
                                    {log?.note && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-notion-text" title="笔记"/>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="flex gap-4 items-center justify-center mt-6 text-[10px] text-notion-dim">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#EBCBCB] border border-[#D6B5B5]"></div> 月经期</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#F0E5D0] border border-[#E0D4BC]"></div> {state.mode === 'ttc' ? '易孕/排卵' : '高能期'}</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#D8E6E2] border border-[#BCCFC9]"></div> {state.mode === 'ttc' ? '平稳期' : '复苏期'}</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#E2E2E6] border border-[#CFCDD6]"></div> {state.mode === 'ttc' ? '等待期' : '守护期'}</div>
            </div>
        </div>
      </div>

      {/* --- Log Modal --- */}
      {editingLog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-notion-text/20 backdrop-blur-sm p-4">
              <div className="bg-white/95 dark:bg-notion-bg w-full max-w-lg rounded-3xl shadow-2xl border border-white/20 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-5 border-b border-notion-border flex justify-between items-center bg-white/50 dark:bg-notion-sidebar">
                      <h3 className="text-lg font-bold text-notion-text flex items-center gap-2">
                          {editingLog.date} 记录
                          {state.logs.find(l => l.date === editingLog.date) && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">已记录</span>}
                      </h3>
                      <button onClick={() => setEditingLog(null)} className="p-2 hover:bg-notion-hover rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Section 1: Period */}
                      <section className="space-y-3">
                          <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-2"><Droplets size={14}/> 经期状况</label>
                          <div className="p-4 bg-notion-sidebar rounded-xl border border-notion-border space-y-4">
                              <label className="flex items-center justify-between cursor-pointer group">
                                  <span className="font-medium text-notion-text group-hover:text-notion-accentText transition-colors">大姨妈来了 (第一天)</span>
                                  <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-notion-border text-notion-accentText focus:ring-notion-accentText"
                                    checked={editingLog.isPeriodStart || false}
                                    onChange={e => setEditingLog({...editingLog, isPeriodStart: e.target.checked})}
                                  />
                              </label>
                              
                              {editingLog.isPeriodStart && (
                                   <div className="pt-3 border-t border-notion-border/50 animate-in slide-in-from-top-2">
                                       <span className="text-xs text-notion-dim mb-2 block">预计持续天数</span>
                                       <div className="flex items-center gap-3">
                                           <input 
                                              type="range" 
                                              min="3" max="10" 
                                              value={editingLog.duration || 5}
                                              onChange={e => setEditingLog({...editingLog, duration: parseInt(e.target.value)})}
                                              className="flex-1 h-2 bg-notion-border rounded-lg appearance-none cursor-pointer accent-notion-accentText"
                                           />
                                           <span className="font-bold text-notion-text w-8 text-center">{editingLog.duration || 5}</span>
                                       </div>
                                   </div>
                              )}

                              <div>
                                  <span className="text-xs text-notion-dim mb-2 block">流量强度</span>
                                  <div className="flex gap-4 justify-around bg-white dark:bg-notion-bg p-3 rounded-xl border border-notion-border">
                                      {[1, 2, 3, 4, 5].map((level) => (
                                          <button
                                            key={level}
                                            onClick={() => setEditingLog({...editingLog, flowLevel: editingLog.flowLevel === level ? 0 : level})}
                                            className={`flex flex-col items-center gap-1 transition-all ${editingLog.flowLevel && editingLog.flowLevel >= level ? 'text-red-500 scale-110' : 'text-notion-dim hover:text-red-300'}`}
                                            title={`强度 ${level}`}
                                          >
                                              <Droplets size={16 + level * 2} className={editingLog.flowLevel && editingLog.flowLevel >= level ? 'fill-current' : ''} />
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </section>

                      {/* Section 2: Body & Mind */}
                      <section className="space-y-3">
                          <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-2"><Smile size={14}/> 身心状态</label>
                          
                          <div className="grid grid-cols-2 gap-3">
                              {/* Mood */}
                              <div className="relative">
                                  <select 
                                    className="w-full p-3 rounded-xl bg-notion-sidebar border border-notion-border text-sm appearance-none outline-none focus:ring-2 focus:ring-notion-accentText/20"
                                    value={editingLog.mood || ''}
                                    onChange={e => setEditingLog({...editingLog, mood: e.target.value})}
                                  >
                                      <option value="">选择心情...</option>
                                      {MOOD_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-notion-dim pointer-events-none"/>
                              </div>
                              
                              {/* Energy - Slider */}
                              <div className="p-3 bg-notion-sidebar rounded-xl border border-notion-border flex flex-col justify-center space-y-2">
                                  <div className="flex justify-between items-center text-xs font-bold text-notion-dim uppercase">
                                      <span className="flex items-center gap-1 text-yellow-600"><Zap size={12} className="fill-current"/> 能量</span>
                                      <span className="text-notion-text">{editingLog.energy ?? 5}</span>
                                  </div>
                                  <input 
                                    type="range" min="0" max="10"
                                    className="w-full h-1.5 bg-notion-border rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                    value={editingLog.energy ?? 5}
                                    onChange={e => setEditingLog({...editingLog, energy: parseInt(e.target.value)})}
                                  />
                              </div>
                          </div>

                          {/* Symptoms Tags */}
                          <div className="flex flex-wrap gap-2">
                              {SYMPTOMS_LIST.map(sym => {
                                  const isActive = editingLog.symptoms?.includes(sym);
                                  return (
                                      <button
                                        key={sym}
                                        onClick={() => {
                                            const current = editingLog.symptoms || [];
                                            const newSyms = isActive ? current.filter(s => s !== sym) : [...current, sym];
                                            setEditingLog({...editingLog, symptoms: newSyms});
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isActive ? 'bg-notion-text text-white border-notion-text' : 'bg-white dark:bg-notion-sidebar border-notion-border text-notion-dim hover:border-notion-text'}`}
                                      >
                                          {sym}
                                      </button>
                                  );
                              })}
                          </div>
                      </section>

                      {/* Section 3: Intimacy & Health */}
                      <section className="space-y-3">
                           <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-2"><Heart size={14}/> 亲密与健康</label>
                           <div className="p-4 bg-notion-sidebar rounded-xl border border-notion-border space-y-4">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500 border-gray-300"
                                            checked={!!editingLog.sexualActivity}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setEditingLog({...editingLog, sexualActivity: { times: 1, protection: '无措施' }});
                                                } else {
                                                    setEditingLog({...editingLog, sexualActivity: undefined});
                                                }
                                            }}
                                        />
                                        <span className="text-sm font-medium text-notion-text">同房</span>
                                    </label>
                                    
                                    {editingLog.sexualActivity && (
                                        <select 
                                            className="flex-1 p-2 rounded-lg bg-white dark:bg-notion-bg border border-notion-border text-xs outline-none"
                                            value={editingLog.sexualActivity.protection}
                                            onChange={e => setEditingLog({
                                                ...editingLog, 
                                                sexualActivity: { ...editingLog.sexualActivity!, protection: e.target.value }
                                            })}
                                        >
                                            {PROTECTION_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1 flex items-center gap-2 bg-white dark:bg-notion-bg px-3 py-2 rounded-lg border border-notion-border">
                                        <Thermometer size={14} className="text-notion-dim"/>
                                        <input 
                                            type="number" step="0.1" placeholder="体温 ℃"
                                            className="w-full bg-transparent border-none outline-none text-xs"
                                            value={editingLog.weight || ''} // Using weight field for temperature temporarily or add temp field later, here reusing valid field from types
                                            onChange={e => setEditingLog({...editingLog, weight: parseFloat(e.target.value)})}
                                        />
                                    </div>
                                </div>
                           </div>
                      </section>
                  </div>

                  <div className="p-5 border-t border-notion-border bg-white/50 dark:bg-notion-sidebar flex justify-end">
                      <button 
                        onClick={saveLog}
                        className="px-8 py-3 bg-notion-text text-white dark:text-black rounded-xl font-bold hover:opacity-90 shadow-lg transition-opacity"
                      >
                          保存记录
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
