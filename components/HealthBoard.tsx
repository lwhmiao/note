
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

  // Wrapper for Calendar Grid
  const getPhaseConfig = (dateStr: string) => calculatePhase(dateStr);

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
  
  // MODIFIED: Prioritize AI Analysis Phase if available
  let displayPhaseLabel = state.analysis.currentPhase;
  
  if (state.mode === 'pregnancy') {
      displayPhaseLabel = '孕期';
  } else if (!displayPhaseLabel || displayPhaseLabel === '需分析') {
      displayPhaseLabel = todayCalculated.label || "等待分析";
      // Fallback for gaps
      if (displayPhaseLabel === '等待分析' && !isTodayLogged && !todayCalculated.label && !todayCalculated.isPredicted) {
          displayPhaseLabel = state.mode === 'ttc' ? '等待期' : '守护期';
      }
  }

  // MODIFIED: Removed Day X info as requested
  const displayDayInfo = null;

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
                              {state.analysis.advice || "记录经期并点击分析，获取针对当前阶段的专属建议。"}
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
            <div className="grid grid-cols-7 gap-2 mb-4">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-notion-dim uppercase py-1">{d}</div>
                ))}
                
                {days.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} className="min-h-[60px]" />; // Shorter spacer
                    
                    const dStr = toLocalDateStr(date);
                    const isToday = dStr === todayStr;
                    
                    // FIX 2: Future Check for Interaction
                    const todayDate = new Date();
                    todayDate.setHours(0,0,0,0);
                    const cellDate = new Date(date);
                    cellDate.setHours(0,0,0,0);
                    const isFuture = cellDate > todayDate;

                    const log = logMap[dStr];
                    const { style: phaseStyle, opacityClass } = getPhaseConfig(dStr);
                    const hasLog = log && (log.mood || log.symptoms?.length || log.weight || log.sexualActivity);

                    return (
                        <div 
                          key={dStr}
                          onClick={() => !isFuture && openLogModal(dStr)}
                          className={`min-h-[60px] rounded-xl p-1.5 relative transition-all flex flex-col items-center justify-start gap-0.5 border-transparent ${
                              isFuture ? 'cursor-default opacity-80' : 'cursor-pointer hover:scale-[1.02] hover:border-notion-border hover:shadow-sm'
                          } ${phaseStyle || PHASE_STYLES['default']} ${opacityClass}`}
                        >
                            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-notion-text text-notion-bg shadow-md' : ''}`}>
                                {date.getDate()}
                            </span>
                            
                            <div className="flex gap-0.5 mt-0.5">
                                {hasLog && <div className="w-1 h-1 rounded-full bg-current opacity-60"/>}
                                {log?.sexualActivity && <div className="w-1 h-1 rounded-full bg-red-400 opacity-80"/>}
                            </div>
                            
                            {log?.mood && <span className="text-[8px] opacity-80 leading-none mt-0.5">{log.mood.split(' ')[0]}</span>}
                        </div>
                    );
                })}
            </div>

            {/* Legend / Footer */}
            <div className="pt-4 border-t border-notion-border">
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                    {state.mode === 'self_care' ? (
                        <>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['menstrual'].split(' ')[0]}`}/> 月经期</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['follicular'].split(' ')[0]}`}/> 复苏期</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['ovulation'].split(' ')[0]}`}/> 高能期</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['luteal'].split(' ')[0]}`}/> 守护期</div>
                        </>
                    ) : state.mode === 'ttc' ? (
                        <>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['menstrual'].split(' ')[0]}`}/> 月经期</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['ttc_stable'].split(' ')[0]}`}/> 平稳期</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['ttc_high'].split(' ')[0]}`}/> 易孕期</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['ttc_peak'].split(' ')[0]}`}/> 排卵日</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-notion-dim"><div className={`w-2.5 h-2.5 rounded-full ${PHASE_STYLES['ttc_waiting'].split(' ')[0]}`}/> 等待期</div>
                        </>
                    ) : null}
                </div>
            </div>

        </div>

        {/* Log Modal */}
        {selectedDateStr && editingLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-notion-dark/30 backdrop-blur-sm p-4">
              <div className="bg-white/95 dark:bg-notion-bg w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-white/20 animate-in zoom-in-95 duration-200 transition-colors">
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2">
                           <h3 className="text-lg font-bold text-notion-text">身体日记</h3>
                           <span className="text-xs font-mono text-notion-dim bg-notion-sidebar px-2 py-1 rounded-lg">{selectedDateStr}</span>
                      </div>
                      <button onClick={() => { setSelectedDateStr(null); setEditingLog(null); }} className="text-notion-dim hover:text-notion-text"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                      
                      {/* Period Toggle with Duration Slider */}
                      <div className="flex flex-col gap-4 p-4 bg-notion-sidebar rounded-xl border border-notion-border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-notion-text flex items-center gap-2"><Droplets size={16}/> 经期状态</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setEditingLog(prev => ({
                                        ...prev, 
                                        isPeriodStart: !prev?.isPeriodStart,
                                        duration: !prev?.isPeriodStart ? defaultDuration : prev?.duration
                                    }))}
                                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${editingLog.isPeriodStart ? 'bg-notion-accentText text-white border-notion-accentText' : 'bg-notion-bg border-notion-border text-notion-dim'}`}
                                >
                                    经期开始
                                </button>
                            </div>
                          </div>

                          {/* Duration Slider - Only show if Period Start is active */}
                          {editingLog.isPeriodStart && (
                              <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                                  <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-1 justify-between">
                                      <span className="flex items-center gap-1"><Clock size={12}/> 持续天数</span>
                                      <span className="text-notion-accentText">{editingLog.duration || 5} 天</span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="2" 
                                    max="14" 
                                    value={editingLog.duration || 5}
                                    onChange={(e) => setEditingLog(prev => ({...prev, duration: parseInt(e.target.value)}))}
                                    className="w-full accent-notion-accentText"
                                  />
                                  <p className="text-[10px] text-notion-dim opacity-70">将自动标记未来几天为经期</p>
                              </div>
                          )}
                          
                          {/* Flow Selector */}
                          <div className="pt-2 border-t border-notion-border/50">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-notion-dim uppercase">流量</span>
                                <span className="text-xs text-notion-dim">{editingLog.flowLevel ? `${editingLog.flowLevel}级` : '未记录'}</span>
                             </div>
                             <div className="flex justify-between px-2">
                                {[1, 2, 3, 4, 5].map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setEditingLog(prev => ({...prev, flowLevel: prev?.flowLevel === level ? 0 : level}))}
                                        className={`p-2 rounded-full transition-all ${
                                            (editingLog.flowLevel || 0) >= level 
                                            ? 'text-notion-accentText scale-110' 
                                            : 'text-notion-border hover:text-notion-dim'
                                        }`}
                                    >
                                        <Droplets size={16 + (level * 2)} className={ (editingLog.flowLevel || 0) >= level ? "fill-current" : "" } />
                                    </button>
                                ))}
                             </div>
                          </div>
                      </div>

                      {/* Sexual Activity Tracking (New) */}
                      <div className="p-4 bg-white/50 dark:bg-notion-bg/50 rounded-xl border border-notion-border space-y-3">
                         <div className="flex justify-between items-center">
                             <span className="text-sm font-bold text-notion-text flex items-center gap-2"><HeartHandshake size={16}/> 性生活</span>
                             <button
                               onClick={() => setEditingLog(prev => ({ 
                                   ...prev, 
                                   sexualActivity: prev?.sexualActivity 
                                     ? undefined 
                                     : { times: 1, protection: '无措施' } 
                               }))}
                               className={`w-10 h-6 rounded-full p-1 transition-colors flex items-center ${editingLog.sexualActivity ? 'bg-notion-accentText justify-end' : 'bg-notion-border justify-start'}`}
                             >
                                 <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                             </button>
                         </div>
                         
                         {editingLog.sexualActivity && (
                             <div className="pt-2 animate-in fade-in slide-in-from-top-1 space-y-3">
                                 <div className="flex justify-between items-center">
                                     <span className="text-xs text-notion-dim">次数</span>
                                     <div className="flex items-center gap-3">
                                         <button 
                                            onClick={() => setEditingLog(prev => ({...prev, sexualActivity: {...prev!.sexualActivity!, times: Math.max(1, prev!.sexualActivity!.times - 1)}}))}
                                            className="w-6 h-6 rounded-full bg-notion-sidebar border border-notion-border text-notion-dim flex items-center justify-center"
                                         >-</button>
                                         <span className="text-sm font-bold w-4 text-center">{editingLog.sexualActivity.times}</span>
                                         <button 
                                            onClick={() => setEditingLog(prev => ({...prev, sexualActivity: {...prev!.sexualActivity!, times: prev!.sexualActivity!.times + 1}}))}
                                            className="w-6 h-6 rounded-full bg-notion-sidebar border border-notion-border text-notion-dim flex items-center justify-center"
                                         >+</button>
                                     </div>
                                 </div>
                                 
                                 <div className="space-y-1">
                                     <span className="text-xs text-notion-dim flex items-center gap-1"><Shield size={10}/> 保护措施</span>
                                     <select 
                                        value={editingLog.sexualActivity.protection}
                                        onChange={(e) => setEditingLog(prev => ({...prev, sexualActivity: {...prev!.sexualActivity!, protection: e.target.value}}))}
                                        className="w-full p-2 rounded-lg bg-notion-sidebar border border-notion-border text-xs outline-none"
                                     >
                                         {PROTECTION_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                                     </select>
                                 </div>
                             </div>
                         )}
                      </div>

                      {/* Energy Slider */}
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-1"><Zap size={14}/> 能量值 ({editingLog.energy || 5})</label>
                          <input 
                            type="range" 
                            min="1" 
                            max="10" 
                            value={editingLog.energy || 5}
                            onChange={(e) => setEditingLog(prev => ({...prev, energy: parseInt(e.target.value)}))}
                            className="w-full accent-notion-accentText"
                          />
                      </div>

                      {/* Mood */}
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-1"><Smile size={14}/> 心情</label>
                          <div className="flex flex-wrap gap-2">
                              {MOOD_LIST.map(m => (
                                  <button
                                    key={m}
                                    onClick={() => setEditingLog(prev => ({...prev, mood: prev?.mood === m ? undefined : m}))}
                                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${editingLog.mood === m ? 'bg-notion-accent border-notion-accentBorder text-notion-accentText font-bold' : 'bg-notion-bg border-notion-border text-notion-text'}`}
                                  >
                                      {m}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Symptoms */}
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-1"><Heart size={14}/> 身体感受</label>
                          <div className="flex flex-wrap gap-2">
                              {SYMPTOMS_LIST.map(s => {
                                  const isActive = editingLog.symptoms?.includes(s);
                                  return (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            const current = editingLog.symptoms || [];
                                            const next = isActive ? current.filter(x => x !== s) : [...current, s];
                                            setEditingLog(prev => ({...prev, symptoms: next}));
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${isActive ? 'bg-notion-sidebar border-notion-text text-notion-text font-bold' : 'bg-notion-bg border-notion-border text-notion-dim'}`}
                                    >
                                        {s}
                                    </button>
                                  );
                              })}
                          </div>
                      </div>

                      {/* Weight */}
                      <div className="space-y-2">
                           <label className="text-xs font-bold text-notion-dim uppercase flex items-center gap-1"><Thermometer size={14}/> 体重 (kg)</label>
                           <input 
                             type="number" 
                             step="0.1"
                             value={editingLog.weight || ''}
                             onChange={(e) => setEditingLog(prev => ({...prev, weight: parseFloat(e.target.value)}))}
                             className="w-full p-3 bg-notion-sidebar rounded-xl border-none outline-none text-notion-text font-mono"
                             placeholder="0.0"
                           />
                      </div>
                  </div>

                  <button 
                    onClick={saveLog}
                    className="w-full mt-6 py-3 bg-notion-accentText text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity"
                  >
                      保存记录
                  </button>
              </div>
          </div>
      )}

      </div>
    </div>
  );
};
