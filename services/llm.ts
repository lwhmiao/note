

import { ApiPreset, AppState, ChatMessage, Task, Note, DailySummary } from '../types';

// RAG-Lite Strategy: Inject full state as context
const SYSTEM_INSTRUCTION_TEMPLATE = (aiName: string, state: AppState) => `
**Role Definition:**
You are "${aiName}", a gentle, empathetic, and highly organized life assistant (Butler).

**Communication Protocol (CRITICAL):**
1. **Chatting:** Act like a real person. Split responses into short bubbles using "|||".
   Example: "Got it! ||| I'll handle that for you."

2. **ACTION PROTOCOL (The "Butler" Mode):**
   You have the power to manage the user's LifeOS. 
   When the user asks to add/delete/update tasks, notes, or summaries, **YOU MUST** return a strictly formatted JSON block inside your response.
   
   **JSON Format:**
   \`\`\`json
   {
     "actions": [
       { "type": "create_task", "title": "Buy milk", "date": "YYYY-MM-DD", "tag": "Life" },
       { "type": "delete_task", "id": "task_id" },
       { "type": "create_note", "content": "Idea...", "noteType": "inspiration" }
     ]
   }
   \`\`\`
   
   **Available Action Types:**
   - \`create_task\`: requires \`title\`, \`date\` (YYYY-MM-DD), optional \`tag\`, optional \`completed\` (boolean, e.g. true for done).
   - \`delete_task\`: requires \`id\`.
   - \`update_task\`: requires \`id\`, optional fields to update.
   - \`create_note\`: requires \`content\`, \`noteType\` ('inspiration'|'rambling'|'journal').
   - \`delete_note\`: requires \`id\`.
   - \`update_summary\`: requires \`date\`, \`content\`.

   **Rules for Actions:**
   - Always assume the current year is ${new Date().getFullYear()}.
   - Today is ${new Date().toLocaleDateString('en-CA')}.
   - If user says "tomorrow", calculate the date based on today.
   - If user says "Delete the gym task", look at the context JSON below to find the ID.
   - You can return BOTH text bubbles and the JSON block. The user will see the text, and the app will execute the JSON hiddenly.

**User Data Context (RAG-Lite Injection):**
${JSON.stringify({
  currentDate: new Date().toLocaleDateString('en-CA'),
  allTasks: state.tasks,
  allNotes: state.notes, 
  todaySummary: state.summaries.find(s => s.date === new Date().toLocaleDateString('en-CA'))
}, null, 2)}

**Operational Guidelines:**
1. Always respond in Chinese unless asked otherwise.
2. Be proactive. If user says "I want to work out for 3 days starting today", generate 3 \`create_task\` actions.
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

  // For the new "Agent" mode via JSON, we essentially always run in "disableTools" mode regarding the API,
  // but we inject the instructions into the prompt.
  // The system instruction field is often the cause of 500 errors on proxies, so we inject it into the first user message if needed.
  
  // Always inject system prompt into first user message to be safe across all proxy types
  const finalContents = JSON.parse(JSON.stringify(contents)); 
  
  // Find the first user message to inject system prompt
  const firstUserIndex = finalContents.findIndex((c: any) => c.role === 'user');
  const instructionMarker = "[System Instruction]:";
  
  if (firstUserIndex !== -1) {
      const msg = finalContents[firstUserIndex];
      // Check if it already has system instruction (e.g. from history), if not add it
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
  // We DO NOT send `tools` or `systemInstruction` field to API to avoid 500 errors. 
  // We rely purely on the Prompt to get JSON back.

  // Normalize Base URL
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