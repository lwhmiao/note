
import React, { useState } from 'react';
import { AppSettings, ApiPreset, DEFAULT_PRESET, AppState, ThemeId, ChatMessage } from '../types';
import { X, Save, Plus, Trash2, Download, Upload, RefreshCw, Palette, Globe, Database, Monitor, Type, Copy, Check, CloudDownload, ChevronDown, ShieldAlert, RotateCcw, AlertTriangle } from 'lucide-react';
import { fetchModels } from '../services/llm';
import { v4 as uuidv4 } from 'uuid';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (s: AppSettings) => void;
  appState: AppState;
  onImportState: (s: AppState) => void;
  onImportFullData?: (data: any) => void;
  onResetData: () => void;
  currentMessages?: ChatMessage[];
  currentQuote?: string;
}

const THEMES: { id: ThemeId; name: string; color: string }[] = [
    { id: 'sakura', name: 'Sakura', color: '#E8D5D5' }, 
    { id: 'terracotta', name: 'Terracotta', color: '#D6C6B8' },
    { id: 'matcha', name: 'Matcha', color: '#B4C6B4' },
    { id: 'ocean', name: 'Ocean', color: '#B0C4CC' },
    { id: 'dark', name: 'Dark', color: '#4B5563' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, settings, onSaveSettings, appState, onImportState, onImportFullData, onResetData, currentMessages, currentQuote
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'appearance' | 'api' | 'data'>('appearance');
  const [isTesting, setIsTesting] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleCopyCss = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'globalBackgroundImageUrl') => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Removed 500KB limit as requested
      const reader = new FileReader();
      reader.onloadend = () => {
          setLocalSettings(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
  };

  const updatePreset = (id: string, updates: Partial<ApiPreset>) => {
    setLocalSettings(prev => ({
      ...prev,
      presets: prev.presets.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const addPreset = () => {
    const newPreset: ApiPreset = {
      ...DEFAULT_PRESET,
      id: uuidv4(),
      name: 'New Connection'
    };
    setLocalSettings(prev => ({
      ...prev,
      presets: [...prev.presets, newPreset],
      activePresetId: newPreset.id
    }));
  };

  const removePreset = (e: React.MouseEvent) => {
    // Completely synchronous logic to avoid any event loop/batching issues
    e.preventDefault(); 
    e.stopPropagation();

    const presetsCount = localSettings.presets.length;
    if (presetsCount <= 1) {
        alert("至少需要保留一个配置。");
        return;
    }
    
    if (window.confirm("确定要删除当前配置吗？此操作无法撤销。")) {
        const currentId = localSettings.activePresetId;
        const newPresets = localSettings.presets.filter(p => p.id !== currentId);
        // Fallback to the first one available
        const nextActiveId = newPresets[0]?.id || ''; 
        
        setLocalSettings(prev => ({
            ...prev,
            presets: newPresets,
            activePresetId: nextActiveId
        }));
    }
  };

  const handleFetchModels = async () => {
    const preset = localSettings.presets.find(p => p.id === localSettings.activePresetId);
    if (!preset) return;

    if (!preset.apiKey) {
        alert("请先填入 API Key");
        return;
    }

    setIsTesting(true);
    try {
      const models = await fetchModels(preset.baseUrl, preset.apiKey);
      const names = models.map((m: any) => m.name.replace(/^models\//, ''));
      setFetchedModels(names);
      
      if (names.length > 0) {
          updatePreset(preset.id, { model: names[0] });
      }
      
      alert(`成功获取 ${names.length} 个模型！`);
    } catch (e: any) {
      alert(`拉取失败。\n错误详情：\n${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetAll = () => {
      if(window.confirm("【严重警告】此操作将永久删除所有任务、笔记、回顾和聊天记录！\n\n确定要清空所有数据吗？")) {
          onResetData();
          alert("数据已重置。");
          onClose();
      }
  };

  const activePreset = localSettings.presets.find(p => p.id === localSettings.activePresetId) || localSettings.presets[0];

  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={`flex-1 py-3 text-sm font-bold transition-all relative flex items-center justify-center gap-2 ${
          activeTab === id ? 'text-notion-accentText' : 'text-notion-dim hover:text-notion-text'
        }`}
      >
        <Icon size={16} /> {label}
        {activeTab === id && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-notion-accentText rounded-full" />
        )}
      </button>
  );

  const handleExport = () => {
    // Export Full Snapshot including chat history and settings
    const exportData = {
        version: "2.0",
        timestamp: Date.now(),
        data: appState,
        settings: settings, // Include API keys and personas
        chat: currentMessages || [], // Include chat history
        quote: currentQuote || ""
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `LifeOS_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
        fileReader.readAsText(e.target.files[0], "UTF-8");
        fileReader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string);
                
                // Detection: Version 2.0 (Full Snapshot) or Legacy (AppState only)
                if (parsed.version === "2.0" || (parsed.data && parsed.settings)) {
                    if(confirm("导入将覆盖当前所有应用数据（包括 API 设置和聊天记录），确定吗？")) {
                        if (onImportFullData) onImportFullData(parsed);
                        alert("全量数据导入成功！");
                    }
                } else if (parsed.tasks && parsed.notes) {
                    // Legacy Format
                    if(confirm("检测到旧版备份格式。导入将仅覆盖任务和笔记数据，确定吗？")) {
                        onImportState(parsed);
                        alert("导入成功！");
                    }
                } else {
                    alert("文件格式不正确，无法识别备份数据。");
                }
            } catch (err) {
                alert("无法解析 JSON 文件");
            }
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-notion-text/20 backdrop-blur-sm p-4">
      <div className="bg-notion-bg w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-notion-border flex justify-between items-center bg-notion-sidebar">
          <h2 className="text-xl font-display font-bold text-notion-text">系统设置</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-notion-hover rounded-full transition-colors text-notion-dim">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-notion-border">
          <TabButton id="appearance" label="外观" icon={Palette} />
          <TabButton id="api" label="API 配置" icon={Globe} />
          <TabButton id="data" label="数据" icon={Database} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* --- Appearance Tab --- */}
          {activeTab === 'appearance' && (
              <div className="space-y-8">
                  {/* ... Same as before ... */}
                  <section className="space-y-3">
                      <label className="text-xs font-bold text-notion-dim uppercase tracking-wider">莫兰迪主题 (Morandi Theme)</label>
                      <div className="flex gap-4">
                          {THEMES.map(theme => (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() => setLocalSettings(s => ({ ...s, themeId: theme.id }))}
                                className={`group relative w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all ${localSettings.themeId === theme.id ? 'border-notion-text shadow-md scale-105' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: theme.color }}
                              >
                                  {localSettings.themeId === theme.id && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                  <span className="absolute -bottom-6 text-[10px] font-medium text-notion-dim opacity-0 group-hover:opacity-100 transition-opacity">{theme.name}</span>
                              </button>
                          ))}
                      </div>
                  </section>
                  
                  <section className="space-y-3 pt-4 border-t border-notion-border">
                     <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-notion-dim uppercase tracking-wider flex items-center gap-2"><Type size={14}/> 字体设置</label>
                        <button onClick={() => setLocalSettings(s => ({...s, fontSize: 14, customFontUrl: ''}))} className="text-xs flex items-center gap-1 text-notion-dim hover:text-notion-text transition-colors">
                            <RotateCcw size={12}/> 恢复默认
                        </button>
                     </div>
                     <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                             <span className="text-sm font-medium text-notion-text w-16">全局字号</span>
                             <div className="flex items-center gap-3 flex-1">
                                <input 
                                  type="number" 
                                  min="12" 
                                  max="24"
                                  value={localSettings.fontSize}
                                  onChange={(e) => setLocalSettings(s => ({ ...s, fontSize: parseInt(e.target.value) || 14 }))}
                                  className="w-20 p-2.5 rounded-xl border border-notion-border text-center font-bold text-notion-text outline-none focus:ring-2 focus:ring-notion-accent/50 bg-notion-sidebar"
                                />
                                <span className="text-sm text-notion-dim">px (默认 14px)</span>
                             </div>
                        </div>
                        <div className="space-y-1.5">
                            <span className="text-sm font-medium text-notion-text">自定义字体 (CSS URL)</span>
                            <input 
                                className="w-full p-2.5 rounded-xl border border-notion-border text-xs font-mono placeholder:text-gray-400 focus:ring-2 focus:ring-notion-accent/50 outline-none bg-notion-sidebar text-notion-text"
                                placeholder="https://fonts.googleapis.com/css2?family=..."
                                value={localSettings.customFontUrl}
                                onChange={e => setLocalSettings(s => ({ ...s, customFontUrl: e.target.value }))}
                            />
                        </div>
                     </div>
                  </section>
                  <section className="space-y-3 pt-4 border-t border-notion-border">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-notion-dim uppercase tracking-wider flex items-center gap-2"><Monitor size={14}/> 全局背景</label>
                        {localSettings.globalBackgroundImageUrl && (
                            <button onClick={() => setLocalSettings(s => ({...s, globalBackgroundImageUrl: ''}))} className="text-xs flex items-center gap-1 text-notion-dim hover:text-notion-text transition-colors">
                                <RotateCcw size={12}/> 清除背景
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input 
                          className="flex-1 p-3 rounded-xl bg-notion-sidebar border border-notion-border text-xs font-mono placeholder:text-gray-400 truncate focus:ring-2 focus:ring-notion-accent/50 outline-none text-notion-text"
                          placeholder="图片 URL (https://...)"
                          value={localSettings.globalBackgroundImageUrl}
                          onChange={e => setLocalSettings(s => ({ ...s, globalBackgroundImageUrl: e.target.value }))}
                        />
                        <label className="p-3 bg-notion-sidebar hover:bg-notion-hover border border-notion-border rounded-xl cursor-pointer transition-colors">
                            <Upload size={18} className="text-notion-dim"/>
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'globalBackgroundImageUrl')} />
                        </label>
                    </div>
                 </section>
              </div>
          )}

          {/* --- API Tab --- */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {localSettings.presets.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLocalSettings(s => ({ ...s, activePresetId: preset.id }))}
                    className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap border transition-all flex items-center gap-2 ${
                      localSettings.activePresetId === preset.id
                        ? 'bg-notion-accent border-notion-accentBorder text-notion-accentText font-bold shadow-sm'
                        : 'bg-notion-sidebar border-notion-border text-notion-dim hover:border-notion-dim'
                    }`}
                  >
                    {localSettings.activePresetId === preset.id && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                    {preset.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={addPreset}
                  className="px-3 py-2 rounded-xl border border-dashed border-notion-dim text-notion-dim hover:text-notion-text hover:border-notion-text transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="space-y-4 p-5 bg-notion-sidebar rounded-2xl border border-notion-border">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-notion-text">配置详情</h3>
                    {localSettings.presets.length > 1 && (
                        <button 
                            type="button"
                            onClick={removePreset}
                            className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg cursor-pointer z-10 border border-transparent hover:border-red-200"
                            title="删除此配置"
                        >
                            <Trash2 size={14}/> 删除
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-notion-text">配置名称</label>
                      <input
                        type="text"
                        value={activePreset.name}
                        onChange={e => updatePreset(activePreset.id, { name: e.target.value })}
                        className="w-full p-3 rounded-xl border border-notion-border text-sm focus:ring-2 focus:ring-notion-accent/50 outline-none bg-notion-bg text-notion-text"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-notion-text">API Endpoint (Base URL)</label>
                      <input
                        type="text"
                        value={activePreset.baseUrl}
                        onChange={e => updatePreset(activePreset.id, { baseUrl: e.target.value })}
                        className="w-full p-3 rounded-xl border border-notion-border text-sm font-mono text-notion-dim focus:text-notion-text focus:ring-2 focus:ring-notion-accent/50 outline-none transition-colors bg-notion-bg"
                        placeholder="https://generativelanguage.googleapis.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-notion-text">API Key</label>
                      <input
                        type="password"
                        value={activePreset.apiKey}
                        onChange={e => updatePreset(activePreset.id, { apiKey: e.target.value })}
                        className="w-full p-3 rounded-xl border border-notion-border text-sm font-mono focus:ring-2 focus:ring-notion-accent/50 outline-none bg-notion-bg text-notion-text"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-notion-text">模型名称</label>
                      <div className="relative">
                        {fetchedModels.length > 0 ? (
                           <div className="relative">
                               <select 
                                   className="w-full p-3 pr-10 rounded-xl border border-notion-border text-sm font-mono focus:ring-2 focus:ring-notion-accent/50 outline-none bg-notion-bg appearance-none text-notion-text"
                                   value={activePreset.model}
                                   onChange={e => updatePreset(activePreset.id, { model: e.target.value })}
                               >
                                   {fetchedModels.map(m => <option key={m} value={m}>{m}</option>)}
                               </select>
                               <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-notion-dim pointer-events-none"/>
                           </div>
                        ) : (
                            <>
                                <input
                                type="text"
                                value={activePreset.model}
                                onChange={e => updatePreset(activePreset.id, { model: e.target.value })}
                                className="w-full p-3 rounded-xl border border-notion-border text-sm font-mono focus:ring-2 focus:ring-notion-accent/50 outline-none bg-notion-bg text-notion-text"
                                placeholder="gemini-1.5-flash"
                                list="model-options"
                                />
                                <datalist id="model-options">
                                    <option value="gemini-2.0-flash-exp" />
                                    <option value="gemini-1.5-pro" />
                                    <option value="gpt-4o" />
                                    <option value="claude-3-5-sonnet" />
                                </datalist>
                            </>
                        )}
                      </div>
                    </div>
                    
                    {/* Compatibility Toggle */}
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors">
                        <input 
                            type="checkbox"
                            checked={activePreset.disableTools || false}
                            onChange={e => updatePreset(activePreset.id, { disableTools: e.target.checked })}
                            className="w-5 h-5 rounded border-orange-300 text-orange-500 focus:ring-orange-200"
                        />
                        <div className="flex-1">
                            <span className="text-sm font-bold text-orange-800 flex items-center gap-1"><ShieldAlert size={14}/> 兼容模式：禁用工具调用</span>
                            <p className="text-[10px] text-orange-600/80 leading-tight">如果遇到 500 错误或 "convert_request_failed"，请勾选此项。这将禁用管理任务/笔记的自动化功能。</p>
                        </div>
                    </label>

                    <button 
                        type="button"
                        onClick={handleFetchModels}
                        disabled={isTesting || !activePreset.apiKey}
                        className="w-full mt-2 py-3 bg-notion-text text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        {isTesting ? <RefreshCw size={18} className="animate-spin"/> : <CloudDownload size={18}/>}
                        {isTesting ? '正在尝试连接...' : '拉取并更新模型列表'}
                    </button>
                    {fetchedModels.length > 0 && (
                        <p className="text-center text-xs text-green-600 font-medium">列表已更新，已自动选择第一个模型。</p>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* --- Data Tab --- */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="p-6 bg-notion-sidebar rounded-2xl border border-notion-border shadow-sm flex flex-col items-center text-center gap-4 hover:border-green-200 transition-colors group">
                 <div className="p-3 bg-green-50 rounded-full text-green-600 group-hover:scale-110 transition-transform">
                    <Download size={24} />
                 </div>
                 <div>
                   <h3 className="font-bold text-notion-text">备份数据 (全量)</h3>
                   <p className="text-sm text-notion-dim mt-1">导出任务、笔记、聊天记录、API 配置和个人偏好。</p>
                 </div>
                 <button type="button" onClick={handleExport} className="px-6 py-2 bg-notion-text text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity">
                   导出全量快照 (JSON)
                 </button>
              </div>

              <div className="p-6 bg-notion-sidebar rounded-2xl border border-notion-border shadow-sm flex flex-col items-center text-center gap-4 hover:border-orange-200 transition-colors group">
                 <div className="p-3 bg-orange-50 rounded-full text-orange-600 group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                 </div>
                 <div>
                   <h3 className="font-bold text-notion-text">恢复数据</h3>
                   <p className="text-sm text-notion-dim mt-1">支持全量快照或旧版数据。<br/><span className="text-red-400">警告：将覆盖当前所有数据。</span></p>
                 </div>
                 <label className="px-6 py-2 bg-white border border-notion-border text-notion-text rounded-xl font-medium hover:bg-notion-hover transition-colors cursor-pointer">
                   选择备份文件
                   <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                 </label>
              </div>

              {/* Danger Zone */}
              <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center text-center gap-4 hover:bg-red-50 transition-colors">
                  <div className="p-3 bg-red-100 rounded-full text-red-500">
                      <AlertTriangle size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-red-800">危险区域</h3>
                      <p className="text-sm text-red-600/70 mt-1">永久清空所有应用数据，无法恢复。</p>
                  </div>
                  <button type="button" onClick={handleResetAll} className="px-6 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-opacity flex items-center gap-2">
                      <Trash2 size={16}/> 彻底重置
                  </button>
              </div>
            </div>
          )}

        </div>

        <div className="p-6 border-t border-notion-border bg-notion-sidebar flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 bg-notion-accentText text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-pink-200/50"
          >
            <Save size={18} />
            保存生效
          </button>
        </div>

      </div>
    </div>
  );
};
