
import { ApiPreset, AppState, ChatMessage, Task, Note, DailySummary } from '../types';

// RAG-Lite Strategy: Inject full state as context
const SYSTEM_INSTRUCTION_TEMPLATE = (aiName: string, state: AppState) => `
**Role Definition:**
You are "${aiName}", a gentle, empathetic, and highly organized life assistant (Butler).

**Communication Protocol (CRITICAL):**
1. **Chatting:** Act like a real person. **YOU MUST** split your responses into multiple short bubbles using "|||" as a separator between distinct thoughts or sentences.
   Example: "好的，没问题！ ||| 我已经帮你把买牛奶的任务加进去了。 ||| 还有什么我可以帮你的吗？"

2. **ACTION PROTOCOL (The "Butler" Mode):**
   You have the power to manage the user's LifeOS. 
   When the user asks to add/delete/update tasks, notes, or summaries, **YOU MUST** return a strictly formatted JSON block.
   
   **JSON Format:**
   \`\`\`json
   {
     "actions": [
       { "type": "create_task", "title": "Buy milk", "date": "YYYY-MM-DD", "tag": "Life" },
       { "type": "create_backlog_task", "title": "Learn Spanish", "quadrant": 2, "taskType": "longterm" }
     ]
   }
   \`\`\`
   
   **Available Action Types:**
   - \`create_task\`: Create Calendar Task. Requires \`title\`, \`date\` (YYYY-MM-DD). Optional \`tag\`.
   - \`delete_task\`: Requires \`id\`.
   - \`update_task\`: Requires \`id\`, optional fields.
   - \`create_note\`: Requires \`content\`, \`noteType\` ('inspiration'|'rambling'|'journal').
   - \`delete_note\`: Requires \`id\`.
   - \`update_summary\`: Requires \`date\`, \`content\`.
   - \`create_backlog_task\`: Create Plan/Backlog Item. Requires \`title\`, \`quadrant\` (1-4), \`taskType\` ('once'|'longterm').
   - \`delete_backlog_task\`: Requires \`id\`.
   - \`update_backlog_task\`: Requires \`id\`, optional fields.

   **PLANNING RULES (Eisenhower Matrix / Backlog):**
   - If the user says "add X to my plan" or "I want to do X sometime", **DO NOT** immediately create a backlog task.
   - **YOU MUST ASK**: 
     1. "Is this Urgent and Important?" (To determine Quadrant 1-4).
     2. "Is this a one-time task or a long-term habit?" (To determine 'once' vs 'longterm').
   - ONLY generate \`create_backlog_task\` after the user confirms these details, OR if the user explicitly says "just put it in backlog".
   - Quadrant Definitions:
     Q1: Urgent & Important.
     Q2: Important & Not Urgent.
     Q3: Urgent & Not Important.
     Q4: Not Urgent & Not Important.

   **General Rules:**
   - Always assume the current year is ${new Date().getFullYear()}.
   - Today is ${new Date().toLocaleDateString('en-CA')}.
   - If user says "tomorrow", calculate the date based on today.
   - Context below contains current tasks/notes.

**User Data Context (RAG-Lite Injection):**
${JSON.stringify({
  currentDate: new Date().toLocaleDateString('en-CA'),
  calendarTasks: state.tasks,
  backlogTasks: state.backlogTasks, // Inject Backlog
  recentNotes: state.notes.slice(0, 5), 
  todaySummary: state.summaries.find(s => s.date === new Date().toLocaleDateString('en-CA'))
}, null, 2)}

**Operational Guidelines:**
1. Always respond in Chinese unless asked otherwise.
2. Be proactive but careful with the Plan Board (Backlog).
3. Be warm and supportive.
`;

export const fetchModels = async (baseUrl: string, apiKey: string) => {
  // Remove trailing slash
  let cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Clean up common suffixes users might paste
  cleanBaseUrl = cleanBaseUrl.replace(/\/chat\/completions$/, '');
  cleanBaseUrl = cleanBaseUrl.replace(/\/models$/, '');

  const errors: string[] = [];

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
  const { baseUrl, apiKey, model } = preset;
  
  const contents = history.map(msg => {
    if (msg.role === 'model') return { role: 'model', parts: msg.parts || [{ text: msg.text }] };
    if (msg.role === 'function') return { role: 'function', parts: msg.parts };
    
    const parts: any[] = [];
    if (msg.text) parts.push({ text: msg.text });
    if (msg.image) {
         const mimeType = msg.image.match(/^data:(.*?);base64,/)?.[1] || "image/jpeg";
         parts.push({ inlineData: { mimeType, data: msg.image.split(',')[1] } });
    }
    return { role: 'user', parts };
  });

  if (userMessage || userImage) {
      const currentParts: any[] = [];
      if (userMessage) currentParts.push({ text: userMessage });
      if (userImage) {
          const mimeType = userImage.match(/^data:(.*?);base64,/)?.[1] || "image/jpeg";
          const base64Data = userImage.split(',')[1];
          currentParts.push({ inlineData: { mimeType, data: base64Data } });
      }
      contents.push({ role: 'user', parts: currentParts });
  }

  const systemText = SYSTEM_INSTRUCTION_TEMPLATE(aiName, fullState);
  const payload: any = {};
  
  const finalContents = JSON.parse(JSON.stringify(contents)); 
  const firstUserIndex = finalContents.findIndex((c: any) => c.role === 'user');
  const instructionMarker = "[System Instruction]:";
  
  if (firstUserIndex !== -1) {
      const msg = finalContents[firstUserIndex];
      const hasInstruction = msg.parts.some((p:any) => p.text && p.text.includes(instructionMarker));
      
      if (!hasInstruction) {
          if (msg.parts && msg.parts.length > 0 && msg.parts[0].text) {
              msg.parts[0].text = `${instructionMarker}\n${systemText}\n\n[User Request]:\n${msg.parts[0].text}`;
          } else {
              msg.parts.unshift({ text: `${instructionMarker}\n${systemText}` });
          }
      }
  } else {
      finalContents.unshift({ role: 'user', parts: [{ text: `${instructionMarker}\n${systemText}` }] });
  }
  
  payload.contents = finalContents;

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  let url = '';
  if (cleanBaseUrl.includes('v1beta')) {
      url = `${cleanBaseUrl}/${model}:generateContent?key=${apiKey}`;
  } else if (cleanBaseUrl.endsWith('/v1')) {
      url = `${cleanBaseUrl}/models/${model}:generateContent?key=${apiKey}`; 
  } else {
      url = `${cleanBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey, 
      'Authorization': `Bearer ${apiKey}` 
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 500) {
        throw new Error(`API 500 错误: 服务端处理失败。请确保模型支持较长的 Context。\n\n原始错误: ${err}`);
    }
    throw new Error(`API Error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data; 
};
