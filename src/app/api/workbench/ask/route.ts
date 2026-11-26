import { createClient } from '@/lib/supabase/server';
import { findPassages } from '../../../../lib/project-document-search.ts';
import { computedWallAnswer } from '../../../../lib/project-wall-answer.ts';
import { computedCategoryAnswer } from '../../../../lib/project-category-answer.ts';
import { extractiveAnswer } from '../../../../lib/project-extractive-answer.ts';
import { failure, jsonResponse, readInput } from '../http.ts';
import { readShare } from '../shares/store.ts';
import { AskError, maxRequestBytes, parseCompletion, prepareTask, type Task } from './contract.ts';
import { completeTask, ProviderUnavailable } from './provider.ts';
import { checkRate, requireWorkbenchOrigin } from './access.ts';

async function answerTask(task: Task) {
  if (task.documents) {
    const question=String(task.input.question);
    const result=computedWallAnswer(question,task.documents) ?? computedCategoryAnswer(question,task.documents);
    if (result) return result;
  }
  try {
    return parseCompletion(task, await completeTask(task));
  } catch (error) {
    if (!(error instanceof ProviderUnavailable) || task.mode !== 'documents' || !task.sourceIds?.size) throw error;
    const excerpt=extractiveAnswer(String(task.input.question),task.documents ?? []);
    if (excerpt) return excerpt;
    const citations = [...task.sourceIds].slice(0, 3).map(id => '[' + id + ']').join(' ');
    return { mode: 'sources-only', answer: 'AI 服务暂时无法生成回答。可打开本次检索的资料片段核对原文。 ' + citations };
  }
}

export async function POST(request: Request) {
  try {
    requireWorkbenchOrigin(request);
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) throw new AskError(401, '请先登录，再使用 AI 问答。');
    const input = await readInput(request, maxRequestBytes);
    if (input && typeof input === 'object' && 'owner' in input && input.owner !== user.id) {
      throw new AskError(403, '登录账号已变更，请重新选择当前账号的资料。');
    }
    if (input && typeof input === 'object' && 'shareId' in input) {
      if (typeof input.shareId !== 'string' || !('question' in input) || typeof input.question !== 'string' ||
          !input.question.trim() || input.question.length > 1000 ||
          Object.keys(input).some(key => !['question', 'shareId', 'owner'].includes(key))) {
        throw new AskError(400, '共享提问需要一个有效链接和不超过 1000 字的问题。');
      }
      checkRate(user.id);
      const share = await readShare(user.id, input.shareId);
      const sources = findPassages(share.documents, input.question);
      if (!sources.length) return jsonResponse({ answer: '这份共享资料中没有检索到相关片段。', sources });
      const task = prepareTask({ question: input.question, documents: sources });
      return jsonResponse({ ...await answerTask(task), sources });
    }
    const task = prepareTask(input);
    checkRate(user.id);
    return jsonResponse(await answerTask(task));
  } catch (error) { return failure(error); }
}
