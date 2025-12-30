
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
  // Remove trailing slash
  let cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Clean up common suffixes users might paste
  cleanBaseUrl = cleanBaseUrl.replace(/\/chat\/completions$/, '');
  cleanBaseUrl = cleanBaseUrl.replace(/\/models$/, '');

  const errors: string[] = [];

  // Strategy: Try different URL structures AND Authentication methods.
  // Many proxies mimic OpenAI's /v1/models and require Authorization header, ignoring ?key=
  // Google requires ?key= and typically uses /v1beta/models.

  const attempts = [
    // 1. OpenAI Style: /v1/models with Bearer Header (Most common for proxies)
    {
      url: `${cleanBaseUrl}/v1/models`,
      headers: { 'Authorization': `Bearer ${apiKey}` }
    },
    // 2. Google Style: /v1beta/models with Query Param (Official Gemini)
    {
      url: cleanBaseUrl.includes('v1beta') ? `${cleanBaseUrl}/models?key=${apiKey}` : `${cleanBaseUrl}/v1beta/models?key=${apiKey}`,
      headers: {}
    },
    // 3. Generic Root: /models with Bearer Header (Some custom proxies)
    {
      url: `${cleanBaseUrl}/models`,
      headers: { 'Authorization': `Bearer ${apiKey}` }
    },
    // 4. OpenAI Style with Query Param (Some proxies allow query param auth)
    {
      url: `${cleanBaseUrl}/v1/models?key=${apiKey}`,
      headers: {}
    }
  ];

  for (const attempt of attempts) {
      try {
          const res = await fetch(attempt.url, { headers: attempt.headers });
          
          if (res.ok) {
              const data = await res.json();
              
              // Normalize response: Google returns { models: [] }, OpenAI returns { data: [] }
              let list = [];
              if (data.models && Array.isArray(data.models)) {
                  list = data.models;
              } else if (data.data && Array.isArray(data.data)) {
                  list = data.data;
              } else if (Array.isArray(data)) {
                  list = data;
              }

              if (list.length > 0) {
                  return list.map((m: any) => ({
                      // Google uses "models/gemini-pro", OpenAI uses "id": "gemini-pro"
                      name: m.name ? m.name.replace(/^models\//, '') : m.id, 
                      displayName: m.displayName || m.id
                  }));
              }
          }
          
          // Collect error for debugging if all fail
          let errorText = `HTTP ${res.status}`;
          try {
             const text = await res.text();
             if (text) errorText += `: ${text.slice(0, 50)}`;
          } catch(e) {}
          errors.push(`[${attempt.url}] -> ${errorText}`);

      } catch (e: any) {
          errors.push(`[${attempt.url}] -> ${e.message}`);
      }
  }

  // If we got here, all attempts failed.
  console.error("Fetch Models Failed:", errors);
  throw new Error(`无法获取模型列表。已尝试多种连接方式均失败。\n请检查 Base URL 是否正确 (如: https://api.openai.com 或 Google Endpoint)。\n\n调试信息:\n${errors.join('\n')}`);
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
  
  // 1. Construct initial content array
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

  // 2. Add current user message
  if (userMessage || userImage) {
      const currentParts: any[] = [];
      if (userMessage) currentParts.push({ text: userMessage });
      if (userImage) {
          const base64Data = userImage.split(',')[1];
          currentParts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
      }
      contents.push({ role: 'user', parts: currentParts });
  }

  const systemText = SYSTEM_INSTRUCTION_TEMPLATE(aiName, fullState);
  const payload: any = {};

  if (disableTools) {
      // --- Compatibility Mode (Fix 500 Errors) ---
      // 1. Do NOT set systemInstruction (many proxies fail to map this).
      // 2. Do NOT set tools.
      // 3. Instead, prepend system prompt to the FIRST user message.
      
      const finalContents = JSON.parse(JSON.stringify(contents)); // Deep copy
      
      // Find the first user message to inject system prompt
      const firstUserIndex = finalContents.findIndex((c: any) => c.role === 'user');
      
      if (firstUserIndex !== -1) {
          const msg = finalContents[firstUserIndex];
          if (msg.parts && msg.parts.length > 0 && msg.parts[0].text) {
              msg.parts[0].text = `[System Instruction]:\n${systemText}\n\n[User Request]:\n${msg.parts[0].text}`;
          } else {
              // If image only, unshift text part
              msg.parts.unshift({ text: `[System Instruction]:\n${systemText}` });
          }
      } else {
          // Fallback if no user message (unlikely), prepend one
          finalContents.unshift({ role: 'user', parts: [{ text: `[System Instruction]:\n${systemText}` }] });
      }
      
      payload.contents = finalContents;
  } else {
      // --- Standard Mode ---
      payload.contents = contents;
      payload.systemInstruction = { parts: [{ text: systemText }] };
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
      // Proxy scenario: Try to use the Google protocol on the proxy endpoint.
      // Many proxies mount Gemini at /v1/models/GEMINI_MODEL:generateContent
      // But if the user put "https://api.proxy.com/v1", we might need to be careful.
      // Let's assume standard Gemini REST path structure relative to the provided base.
      url = `${cleanBaseUrl}/models/${model}:generateContent?key=${apiKey}`; 
  } else {
      // Default Google structure or generic proxy root
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
        throw new Error(`API 500 错误: 服务端处理失败。通常是因为中转不支持 Function Calling 或 System Instruction。\n请尝试在设置中勾选 [兼容模式: 禁用工具调用]。\n\n原始错误: ${err}`);
    }
    throw new Error(`API Error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data; 
};
