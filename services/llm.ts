
import { ApiPreset, AppState, ChatMessage, Task, Note, DailySummary } from '../types';

const TOOL_DEFINITIONS = {
  function_declarations: [
    {
      name: "manage_task",
      description: "Create, update, or delete a task/todo item in the calendar.",
      parameters: {
        type: "OBJECT",
        properties: {
          action: { type: "STRING", enum: ["create", "update", "delete", "complete"] },
          title: { type: "STRING" },
          date: { type: "STRING", description: "YYYY-MM-DD" },
          id: { type: "STRING" },
          tag: { type: "STRING" }
        },
        required: ["action"]
      }
    },
    {
      name: "manage_note",
      description: "Create or delete a note.",
      parameters: {
        type: "OBJECT",
        properties: {
          action: { type: "STRING", enum: ["create", "delete"] },
          content: { type: "STRING" },
          type: { type: "STRING", enum: ["inspiration", "rambling", "journal"] },
          id: { type: "STRING" }
        },
        required: ["action"]
      }
    },
    {
      name: "update_daily_summary",
      description: "Update summary.",
      parameters: {
        type: "OBJECT",
        properties: {
          content: { type: "STRING" },
          date: { type: "STRING" }
        },
        required: ["content"]
      }
    },
    {
      name: "get_current_state",
      description: "Get user data.",
      parameters: { type: "OBJECT", properties: {} }
    }
  ]
};

// RAG-Lite Strategy: Inject full state as context
const SYSTEM_INSTRUCTION_TEMPLATE = (aiName: string, state: AppState) => `
**Role Definition:**
You are "${aiName}", a gentle, empathetic, and organized life assistant.

**Communication Style (CRITICAL):**
1. **Act like a real person sending chat messages.**
2. **DO NOT** output one long block of text.
3. Instead, split your response into multiple short, distinct messages (1 to 10 bubbles) to simulate real-time chatting.
4. Use the delimiter "|||" to separate these messages.
   Example Output: 
   "Hi there! ||| I see you have a lot on your plate today. ||| Shall we tackle the most important task first?"

**User Data Context (RAG-Lite Injection):**
${JSON.stringify({
  today: new Date().toLocaleDateString('en-CA'),
  allTasks: state.tasks,
  allNotes: state.notes, 
  todaySummary: state.summaries.find(s => s.date === new Date().toLocaleDateString('en-CA'))
}, null, 2)}

**Operational Guidelines:**
1. Always respond in Chinese.
2. If user asks to create a task/note, USE TOOLS (Unless functionality is limited).
3. Be proactive and warm.
`;

export const fetchModels = async (baseUrl: string, apiKey: string) => {
  // Remove trailing slash and any hardcoded endpoint paths users might have pasted
  let cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Clean up if user pasted full path like "https://.../v1/chat/completions"
  cleanBaseUrl = cleanBaseUrl.replace(/\/chat\/completions$/, '');
  cleanBaseUrl = cleanBaseUrl.replace(/\/models$/, '');

  const errors: string[] = [];

  // Strategy: Try multiple URL patterns because 3rd party APIs are inconsistent.
  const candidates = [
    // 1. Google Standard (Official)
    cleanBaseUrl.includes('v1beta') ? `${cleanBaseUrl}/models` : `${cleanBaseUrl}/v1beta/models`,
    // 2. Generic /models (Common in proxies)
    `${cleanBaseUrl}/models`,
    // 3. OpenAI Style (Very common in aggregators)
    `${cleanBaseUrl}/v1/models`,
  ];

  // Remove duplicates
  const uniqueUrls = Array.from(new Set(candidates));

  for (const urlWithoutKey of uniqueUrls) {
      // Handle cases where apiKey might already be in query params? Unlikely but possible.
      // Standard way: append key
      const url = `${urlWithoutKey}?key=${apiKey}`;
      
      try {
          const res = await fetch(url);
          if (res.ok) {
              const data = await res.json();
              
              // Handle { models: [] } (Google) or { data: [] } (OpenAI)
              let list = [];
              if (Array.isArray(data.models)) {
                  list = data.models;
              } else if (Array.isArray(data.data)) {
                  list = data.data;
              } else if (Array.isArray(data)) {
                  list = data;
              }

              if (list.length > 0) {
                  return list.map((m: any) => ({
                      // Google uses "models/name", OpenAI uses "id". We normalize to just the name part usually.
                      name: m.name || m.id, 
                      displayName: m.displayName || m.id
                  }));
              }
          }
          
          // Collect error for reporting
          let errorText = `HTTP ${res.status}`;
          try {
             const text = await res.text();
             if (text) errorText += `: ${text.slice(0, 100)}`;
          } catch(e) {}
          errors.push(`[${urlWithoutKey}] -> ${errorText}`);

      } catch (e: any) {
          errors.push(`[${urlWithoutKey}] -> ${e.message}`);
      }
  }

  // If we got here, all attempts failed.
  console.error("Fetch Models Failed:", errors);
  throw new Error(`无法从以下地址获取模型列表:\n${errors.join('\n')}\n\n请确认 Endpoint 是否支持 Google 或 OpenAI 格式的模型列表查询。`);
};

export const generateResponse = async (
  preset: ApiPreset,
  aiName: string,
  history: ChatMessage[],
  fullState: AppState,
  userMessage: string,
  userImage?: string 
) => {
  const { baseUrl, apiKey, model, disableTools } = preset;
  
  const contents = history.map(msg => {
    if (msg.role === 'model') return { role: 'model', parts: msg.parts || [{ text: msg.text }] };
    if (msg.role === 'function') return { role: 'function', parts: msg.parts };
    
    const parts: any[] = [];
    if (msg.text) parts.push({ text: msg.text });
    if (msg.image) {
         parts.push({ inlineData: { mimeType: "image/jpeg", data: msg.image.split(',')[1] } });
    }
    return { role: 'user', parts };
  });

  if (userMessage || userImage) {
      const currentParts: any[] = [];
      if (userMessage) currentParts.push({ text: userMessage });
      if (userImage) {
          const base64Data = userImage.split(',')[1];
          currentParts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
      }
      contents.push({ role: 'user', parts: currentParts });
  }

  const payload: any = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEMPLATE(aiName, fullState) }] },
  };

  // Only inject tools if NOT disabled.
  // This fixes the "convert_request_failed" 500 error for proxies that don't support tools.
  if (!disableTools) {
    payload.tools = [TOOL_DEFINITIONS];
    payload.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  // Normalize Base URL
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  let url = '';
  // Smart construction based on path content
  if (cleanBaseUrl.includes('v1beta')) {
      url = `${cleanBaseUrl}/${model}:generateContent?key=${apiKey}`;
  } else if (cleanBaseUrl.endsWith('/v1')) {
      // Some proxies use /v1/chat/completions but we are forcing Gemini SDK format.
      // If user inputs an OpenAI endpoint, this might fail if the proxy doesn't support Gemini proto on that endpoint.
      // But assuming it's a Gemini compatible endpoint:
      url = `${cleanBaseUrl}/models/${model}:generateContent?key=${apiKey}`; 
  } else {
      // Default Google structure
      url = `${cleanBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    // Improved error message
    if (response.status === 500) {
        throw new Error(`API 500 错误: 服务端处理失败。通常是因为中转不支持 Function Calling。\n请尝试在设置中勾选 [兼容模式: 禁用工具调用]。\n\n原始错误: ${err}`);
    }
    throw new Error(`API Error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data; 
};
