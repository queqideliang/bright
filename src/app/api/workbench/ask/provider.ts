import { AskError, systemInstruction, type Task } from './contract.ts';

export async function completeTask(task: Task): Promise<string> {
  const dashKey = process.env.DASHSCOPE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!dashKey && !geminiKey) throw new AskError(503, '模型问答服务尚未配置。');

  const system = systemInstruction(task.mode);
  const input = JSON.stringify(task.input);
  const tokenLimit = task.mode === 'plan' ? 384 : 1200;
  let endpoint: URL;
  let headers: Record<string, string>;
  let payload: unknown;
  if (dashKey) {
    const base = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
    try { endpoint = new URL(base + '/chat/completions'); }
    catch { throw new AskError(503, '模型问答服务地址配置有误。'); }
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new AskError(503, '模型问答服务需要有效的 HTTPS 地址。');
    }
    headers = { Authorization: 'Bearer ' + dashKey };
    payload = {
      model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
      messages: [{ role: 'system', content: system }, { role: 'user', content: input }],
      response_format: { type: 'json_object' }, enable_thinking: false, max_tokens: tokenLimit,
    };
  } else {
    const model = encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.5-flash');
    endpoint = new URL('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent');
    headers = { 'x-goog-api-key': geminiKey! };
    payload = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: {
        responseMimeType: 'application/json', maxOutputTokens: tokenLimit,
        ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    };
  }

  const signal = AbortSignal.timeout(25_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      cache: 'no-store', redirect: 'error', signal,
    });
    if (response.status === 429) throw new AskError(429, '问答服务当前额度受限，请稍后再试。');
    if (response.status === 401 || response.status === 403) throw new AskError(503, '模型问答服务凭据或授权不可用。');
    if (!response.ok) throw new AskError(502, '问答服务暂时无法处理请求。');
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = dashKey ? data?.choices?.[0]?.message?.content : Array.isArray(parts)
      ? parts.filter(part => !part?.thought && typeof part?.text === 'string').map(part => part.text).join('') : '';
    if (typeof text !== 'string' || !text || text.length > 16000) throw new AskError(502, '问答服务未返回可用答复。');
    return text;
  } catch (error) {
    if (error instanceof AskError) throw error;
    if (signal.aborted) throw new AskError(504, '问答服务响应超时，请稍后重试。');
    throw new AskError(502, '暂时无法连接问答服务。');
  }
}
