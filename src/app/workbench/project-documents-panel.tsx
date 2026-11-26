"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { findPassages, listDocuments, readProjectFile, removeDocument, saveDocument, type ProjectDocument } from '@/lib/project-documents';
import './project-documents.css';

type Sources = ReturnType<typeof findPassages>;
type Answer = { text: string; sources: Sources };
const loginUrl = '/login?next=/workbench';

function DocumentWorkspace({ owner, checkSession }: { owner: string; checkSession: () => void }) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [status, setStatus] = useState('正在读取本机资料…');
  const [error, setError] = useState('');
  const task = useRef<AbortController | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const sourcePanel = useRef<HTMLElement>(null);

  useEffect(() => {
    const pending = new AbortController();
    task.current = pending;
    listDocuments(owner).then(result => {
      if (!pending.signal.aborted) setDocuments(result);
    }).catch(() => {
      if (!pending.signal.aborted) setError('无法读取本机资料。请检查浏览器是否允许本站存储数据。');
    }).finally(() => {
      if (task.current === pending) { task.current = null; setStatus(''); }
    });
    return () => { task.current?.abort(); task.current = null; };
  }, [owner]);

  useEffect(() => {
    if (sourceId) sourcePanel.current?.focus();
  }, [sourceId]);

  function clearAnswer() { setAnswer(null); setSourceId(''); }

  async function perform(label: string, action: (signal: AbortSignal) => Promise<void>) {
    if (task.current) return;
    const current = new AbortController();
    task.current = current;
    setStatus(label);
    setError('');
    clearAnswer();
    try { await action(current.signal); }
    catch (cause) {
      if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : '本次操作失败，请重试。');
    } finally {
      if (task.current === current) { task.current = null; setStatus(''); }
    }
  }

  async function add(files: File[]) {
    await perform('正在读取文件…', async signal => {
      const failures: string[] = [];
      for (const file of files) {
        signal.throwIfAborted();
        setStatus('正在读取 ' + file.name);
        try {
          const passages = await readProjectFile(file);
          signal.throwIfAborted();
          const doc = { owner, id: crypto.randomUUID(), title: file.name, passages };
          await saveDocument(doc);
          signal.throwIfAborted();
          setDocuments(items => [...items, doc]);
          setSelected(items => [...items, doc.id]);
        } catch (cause) {
          signal.throwIfAborted();
          failures.push(file.name + ' · ' + (cause instanceof Error ? cause.message : '保存失败'));
        }
      }
      if (failures.length) setError(failures.join('\n'));
    });
  }

  function remove(id: string) {
    return perform('正在移除资料…', async signal => {
      await removeDocument(owner, id);
      signal.throwIfAborted();
      setDocuments(items => items.filter(item => item.id !== id));
      setSelected(ids => ids.filter(value => value !== id));
    });
  }

  function ask() {
    return perform('正在查找原文并生成回答…', async signal => {
      const text = question.trim();
      const sources = findPassages(documents.filter(item => selected.includes(item.id)), text);
      if (!sources.length) throw new Error('所选资料中未找到相关片段。请换一个关键词或选择其他资料。');
      const { data, error: authError } = await createClient().auth.getUser();
      signal.throwIfAborted();
      if (authError || data.user?.id !== owner) { checkSession(); throw new Error('登录状态已更改，请重新选择资料。'); }
      const response = await fetch('/api/workbench/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal,
        body: JSON.stringify({ owner, question: text, documents: sources.map(source => ({ ...source, title: source.title.slice(0, 210) })) }),
      });
      const body = await response.json().catch(() => ({}));
      signal.throwIfAborted();
      if (response.status === 401) checkSession();
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '暂时无法完成问答，请重试。');
      if (typeof body.answer !== 'string' || !body.answer.trim()) throw new Error('未收到有效答复，请重试。');
      setAnswer({ text: body.answer, sources });
    });
  }

  const busy = !!status;
  const currentSource = answer?.sources.find(source => source.id === sourceId);
  return <>
    <section className="bv-doc-shelf" aria-label="本机资料">
      <div className="bv-doc-row"><h3>本机资料</h3>
        <button type="button" className="bv-doc-secondary" disabled={busy} onClick={() => picker.current?.click()}>添加资料</button>
        <input ref={picker} aria-label="选择资料文件" type="file" hidden multiple accept=".pdf,.docx,.txt,.md" onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length) void add(files);
        }} /></div>
      <p>支持 PDF、DOCX、TXT 和 Markdown，单份最大 12 MiB。资料按账号保存在当前浏览器。</p>
      {documents.length > 0 && <ul>{documents.map(doc => <li key={doc.id}>
        <label><input type="checkbox" checked={selected.includes(doc.id)} disabled={busy} onChange={event => {
          const checked = event.target.checked;
          setSelected(ids => checked ? [...ids, doc.id] : ids.filter(id => id !== doc.id)); clearAnswer();
        }} /> <span>{doc.title}</span></label>
        <button type="button" disabled={busy} aria-label={'移除 ' + doc.title} onClick={() => void remove(doc.id)}>移除</button>
      </li>)}</ul>}
    </section>
    <form onSubmit={event => { event.preventDefault(); if (question.trim() && selected.length) void ask(); }}>
      <label htmlFor="project-document-question">你的问题</label>
      <textarea id="project-document-question" maxLength={1000} rows={3} value={question} disabled={busy}
        placeholder="例如：交付时墙构件必须填写哪些字段？" onChange={event => { setQuestion(event.target.value); clearAnswer(); }} />
      <p>点击提问后，问题与所选资料中检索到的原文片段、文件名和位置会发送给 AI 服务。</p>
      <button className="bv-doc-primary" disabled={busy || !selected.length || !question.trim()}>提问</button>
    </form>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="bv-doc-error">{error}</p>}
    {answer && <section className="bv-doc-answer" data-document-answer="" aria-live="polite">
      <h3>回答</h3><p>{answer.text.split(/(\[S\d+\])/g).map((part, index) => {
        const ref = answer.sources.find(item => '[' + item.id + ']' === part);
        return ref ? <button type="button" key={index} aria-label={'查看引用 ' + ref.id}
          aria-expanded={sourceId === ref.id} onClick={() => setSourceId(ref.id)}>{part}</button> : part;
      })}</p>
      {currentSource && <article ref={sourcePanel} tabIndex={-1} aria-label={'引用 ' + currentSource.id + ' 原文'}>
        <h4>{currentSource.title} · {currentSource.location}</h4><p>{currentSource.text}</p>
      </article>}
    </section>}
  </>;
}

function AuthenticatedWorkspace() {
  const [owner, setOwner] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const sequence = useRef({ value: 0 });
  const check = useCallback(() => {
    const current = ++sequence.current.value;
    void createClient().auth.getUser().then(({ data }) => {
      if (current === sequence.current.value) setOwner(data.user?.id ?? null);
    }).catch(() => { if (current === sequence.current.value) setOwner(null); })
      .finally(() => { if (current === sequence.current.value) setPending(false); });
  }, []);
  useEffect(() => {
    const version = sequence.current;
    check();
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        ++version.value;
        setOwner(session?.user.id ?? null);
        setPending(false);
      }
    });
    window.addEventListener('focus', check);
    return () => { ++version.value; subscription.unsubscribe(); window.removeEventListener('focus', check); };
  }, [check]);
  if (owner) return <DocumentWorkspace key={owner} owner={owner} checkSession={check} />;
  if (pending) return <p role="status">正在检查登录状态…</p>;
  return <div className="bv-doc-login"><p>请登录后添加本机资料并提问。登录会在新标签页打开，当前模型会保留。</p>
    <a className="bv-doc-primary" href={loginUrl} target="_blank" rel="noopener noreferrer">登录</a>
    <button type="button" onClick={check}>重新检查登录状态</button></div>;
}

export default function ProjectDocumentsPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="bv-doc-trigger" aria-haspopup="dialog" onClick={() => {
      dialog.current?.showModal(); setOpen(true);
    }}>项目资料问答</button>
    <dialog className="bv-doc-dialog" aria-label="项目资料问答" ref={dialog} onClose={() => setOpen(false)}>
      <div className="bv-doc-row"><h2>项目资料问答</h2>
        <button type="button" aria-label="关闭项目资料问答" onClick={() => dialog.current?.close()}>关闭</button></div>
      {open && <AuthenticatedWorkspace />}
    </dialog>
  </>;
}
