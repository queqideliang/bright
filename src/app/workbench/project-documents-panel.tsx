"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { findPassages, listDocuments, readProjectFile, removeDocument, saveDocument, type ProjectDocument } from '@/lib/project-documents';
import './project-documents.css';

type Sources = ReturnType<typeof findPassages>;
type Answer = { text: string; sources: Sources; sourcesOnly: boolean };
type ShareSummary = { id: string; title: string; createdAt: string; documentCount: number; passageCount: number };
type SharedView = ShareSummary & { documents: Pick<ProjectDocument, 'title' | 'passages'>[] };
const sharesApi = '/api/workbench/shares';
const sharePath = (id: string) => '/workbench?share=' + encodeURIComponent(id);

async function readReply(response: Response, checkSession: () => void) {
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) checkSession();
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '服务暂时不可用，请重试。');
  return body;
}

function OwnedShares({ owner, chosen, checkSession }: {
  owner: string; chosen: ProjectDocument[]; checkSession: () => void;
}) {
  const [shares, setShares] = useState<ShareSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) return;
    const operation = new AbortController();
    pending.current = operation;
    setBusy(true); setError('');
    fetch(offset ? sharesApi + '?offset=' + offset : sharesApi, { cache: 'no-store', signal: operation.signal })
      .then(response => readReply(response, checkSession)).then(body => {
        if (operation.signal.aborted) return;
        setShares(items => offset ? [...items, ...body.shares.filter((entry: ShareSummary) => !items.some(item => item.id === entry.id))] : body.shares);
        setNextOffset(body.nextOffset ?? null);
      }).catch(() => { if (!operation.signal.aborted) setError('共享列表读取失败，请收起后重新展开。'); })
      .finally(() => { if (pending.current === operation) { pending.current = null; setBusy(false); } });
    return () => { pending.current?.abort(); pending.current = null; };
  }, [active, offset, checkSession]);

  async function update(revokeId?: string) {
    if (pending.current || (!revokeId && !chosen.length)) return;
    const operation = new AbortController();
    pending.current = operation;
    setBusy(true); setError(''); setNote('');
    try {
      const { data } = await createClient().auth.getUser();
      operation.signal.throwIfAborted();
      if (data.user?.id !== owner) { checkSession(); throw new Error('登录状态已更改，请重新打开共享。'); }
      const request: RequestInit = { method: revokeId ? 'DELETE' : 'POST', cache: 'no-store', signal: operation.signal };
      if (!revokeId) {
        request.headers = { 'Content-Type': 'application/json' };
        request.body = JSON.stringify({
          owner, title: title.trim() || chosen[0].title.slice(0, 100),
          documents: chosen.map(doc => ({ title: doc.title, passages: doc.passages })),
        });
      }
      const response = await fetch(revokeId ? sharesApi + '/' + encodeURIComponent(revokeId) : sharesApi, request);
      const body = await readReply(response, checkSession);
      operation.signal.throwIfAborted();
      if (revokeId) {
        setShares(items => items.filter(item => item.id !== revokeId));
        setNextOffset(value => value === null ? null : Math.max(0, value - 1));
        if (link === location.origin + sharePath(revokeId)) setLink('');
        setNote('共享已撤销，链接已失效。');
      } else {
        const created: ShareSummary = body.share;
        setShares(items => [created, ...items]);
        setNextOffset(value => value === null ? null : value + 1);
        setLink(location.origin + sharePath(created.id)); setTitle('');
        setNote('共享已创建。请将链接发给需要使用资料的同事。');
      }
    } catch (cause) {
      if (!operation.signal.aborted) setError(cause instanceof Error ? cause.message : '共享操作失败。');
    } finally {
      if (pending.current === operation) { pending.current = null; setBusy(false); }
    }
  }

  return <details className="bv-doc-sharing" onToggle={event => {
    const open = event.currentTarget.open;
    if (open) setOffset(0);
    setActive(open);
  }}>
    <summary>团队共享</summary>
    <p>创建共享会将所选资料的文件名、提取文字和出处保存到云端。任何持有链接并已登录的人均可查看这些资料的文字并提问。原文件保存在本机。</p>
    <label>共享名称 <input type="text" value={title} maxLength={100} disabled={busy}
      placeholder={chosen[0]?.title || '可选'} onChange={event => setTitle(event.target.value)} /></label>
    <button type="button" className="bv-doc-primary" disabled={busy || !chosen.length} onClick={() => void update()}>
      创建共享链接{chosen.length ? '（' + chosen.length + ' 份）' : ''}</button>
    {link && <div className="bv-share-link"><label>共享链接<input type="text" readOnly value={link} onFocus={event => event.target.select()} /></label>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setNote('链接已复制。'); }
        catch { setNote('请选中上方链接并复制。'); }
      }}>复制链接</button></div>}
    {active && <section aria-label="我创建的共享"><h4>我创建的共享</h4>
      {busy && <p role="status">正在更新共享…</p>}
      {!busy && !shares.length && !error && <p>还没有共享。可以先勾选上方资料，再创建链接。</p>}
      <ul>{shares.map(item => <li key={item.id}><span>{item.title} · {item.documentCount} 份</span>
        <div><button type="button" onClick={() => { setLink(location.origin + sharePath(item.id)); setNote(''); }}>查看链接</button>
          <button type="button" disabled={busy} aria-label={'撤销 ' + item.title} onClick={() => void update(item.id)}>撤销</button></div></li>)}</ul>
      {nextOffset !== null && <button type="button" disabled={busy} onClick={() => setOffset(nextOffset)}>查看更多共享</button>}
    </section>}
    {note && <p role="status">{note}</p>}{error && <p role="alert" className="bv-doc-error">{error}</p>}
  </details>;
}

function DocumentWorkspace({ owner, shareId, checkSession }: { owner: string; shareId: string | null; checkSession: () => void }) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [status, setStatus] = useState(shareId ? '正在读取共享资料…' : '正在读取本机资料…');
  const [error, setError] = useState('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [ocrConsent, setOcrConsent] = useState(false);
  const [slideImageConsent, setSlideImageConsent] = useState(false);
  const [shared, setShared] = useState<SharedView | null>(null);
  const task = useRef<AbortController | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const sourcePanel = useRef<HTMLElement>(null);

  useEffect(() => {
    const pending = new AbortController();
    task.current = pending;
    const load = shareId
      ? fetch(sharesApi + '/' + encodeURIComponent(shareId), { cache: 'no-store', signal: pending.signal })
          .then(response => readReply(response, checkSession)).then(body => { if (!pending.signal.aborted) setShared(body.share); })
      : listDocuments(owner).then(result => { if (!pending.signal.aborted) setDocuments(result); });
    load.catch(cause => {
      if (!pending.signal.aborted) setError(shareId
        ? (cause instanceof Error ? cause.message : '共享资料无法读取，请向提供者确认链接。')
        : '无法读取本机资料。请检查浏览器是否允许本站存储数据。');
    }).finally(() => {
      if (task.current === pending) { task.current = null; setStatus(''); }
    });
    return () => { task.current?.abort(); task.current = null; };
  }, [owner, shareId, checkSession]);

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

  async function add(files: File[], allowCloudOcr = false) {
    await perform('正在读取文件…', async signal => {
      const failures: string[] = [];
      for (const file of files) {
        signal.throwIfAborted();
        setStatus('正在读取 ' + file.name);
        try {
          const passages = await readProjectFile(file, { allowCloudOcr, signal });
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
      const sources = shareId ? [] : findPassages(documents.filter(item => selected.includes(item.id)), text);
      if (!shareId && !sources.length) throw new Error('所选资料中未找到相关片段。请换一个关键词或选择其他资料。');
      const { data, error: authError } = await createClient().auth.getUser();
      signal.throwIfAborted();
      if (authError || data.user?.id !== owner) { checkSession(); throw new Error('登录状态已更改，请重新选择资料。'); }
      const response = await fetch('/api/workbench/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal,
        body: JSON.stringify(shareId ? { owner, shareId, question: text }
          : { owner, question: text, documents: sources.map(source => ({ ...source, title: source.title.slice(0, 210) })) }),
      });
      const body = await response.json().catch(() => ({}));
      signal.throwIfAborted();
      if (response.status === 401) checkSession();
      if (shareId && response.status === 404) setShared(null);
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '暂时无法完成问答，请重试。');
      if (typeof body.answer !== 'string' || !body.answer.trim()) throw new Error('未收到有效答复，请重试。');
      setAnswer({ text: body.answer, sources: shareId ? body.sources : sources, sourcesOnly: body.mode === 'sources-only' });
    });
  }

  const busy = !!status;
  const chosen = documents.filter(doc => selected.includes(doc.id));
  const canAsk = !!question.trim() && (shareId ? !!shared : !!chosen.length);
  const hasSelectedSpreadsheet = (shared?.documents || chosen).some(doc => /\.(?:xlsx?|csv|tsv)$/i.test(doc.title));
  const currentSource = answer?.sources.find(source => source.id === sourceId);
  return <>
    {shareId ? <section className="bv-doc-shelf" aria-label="团队共享资料"><h3>{shared?.title || '团队共享资料'}</h3>
      {shared && <><p>可向这组共享资料提问。点击回答中的引用可查看原文。</p>
        <ul>{shared.documents.map((doc, i) => <li key={i}>{doc.title}</li>)}</ul></>}
      <a href="/workbench">返回我的工作台</a>
    </section> : <section className="bv-doc-shelf" aria-label="本机资料">
      <div className="bv-doc-row"><h3>本机资料</h3>
        <button type="button" className="bv-doc-secondary" disabled={busy} onClick={() => picker.current?.click()}>添加资料</button>
        <input ref={picker} aria-label="选择资料文件" type="file" hidden multiple accept=".xlsx,.xls,.csv,.tsv,.pdf,.docx,.pptx,.ppt,.txt,.md,.jpg,.jpeg,.png,.webp" onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (!files.length) return;
          const image = (file: File) => /\.(?:jpe?g|png|webp)$/i.test(file.name);
          setPendingImages(files.filter(image)); setOcrConsent(false);
          const other = files.filter(file => !image(file));
          if (other.length) void add(other, slideImageConsent);
        }} /></div>
        <p>支持 Excel（XLSX、XLS）、CSV、TSV、PowerPoint（PPTX、PPT）、PDF、DOCX、TXT、Markdown，以及 JPG、PNG、WebP 图片。单个文件最大 12 MiB。</p>
      <label><input type="checkbox" checked={slideImageConsent} disabled={busy}
        onChange={event => setSlideImageConsent(event.target.checked)} /> 添加 PPTX 时，将可见幻灯片中的内嵌图片发送给 AI 识别。图片可能包含幻灯片裁剪区域外的内容。</label>
        {(slideImageConsent || pendingImages.length > 0) && <p>云端识别暂时不可用时，浏览器会在本机识别图片中的简体中文和英文印刷文字。</p>}
        {!!pendingImages.length && <div className="bv-doc-ocr">
        <h4>识别图片文字</h4>
        <ul>{pendingImages.map((file, index) => <li key={index}>{file.name}</li>)}</ul>
        <label><input type="checkbox" checked={ocrConsent} disabled={busy} onChange={event => setOcrConsent(event.target.checked)} />
            我同意将上面选中的图片内容发送给 AI 服务识别。</label>
        <div><button type="button" disabled={busy || !ocrConsent} onClick={() => {
          const files = pendingImages; setPendingImages([]); setOcrConsent(false); void add(files, true);
        }}>识别并添加图片</button> <button type="button" disabled={busy} onClick={() => { setPendingImages([]); setOcrConsent(false); }}>取消</button></div>
      </div>}
      {documents.length > 0 && <ul>{documents.map(doc => <li key={doc.id}>
        <label><input type="checkbox" checked={selected.includes(doc.id)} disabled={busy} onChange={event => {
          const checked = event.target.checked;
          setSelected(ids => checked ? [...ids, doc.id] : ids.filter(id => id !== doc.id)); clearAnswer();
        }} /> <span>{doc.title}</span></label>
        <button type="button" disabled={busy} aria-label={'移除 ' + doc.title} onClick={() => void remove(doc.id)}>移除</button>
      </li>)}</ul>}
      <OwnedShares owner={owner} chosen={chosen} checkSession={checkSession} />
    </section>}
    <form onSubmit={event => { event.preventDefault(); if (canAsk) void ask(); }}>
      <label htmlFor="project-document-question">你的问题</label>
      <textarea id="project-document-question" maxLength={1000} rows={3} value={question} disabled={busy}
        placeholder={hasSelectedSpreadsheet ? '例如：“墙体明细”中，构件 W-01 的体积是多少？' : '例如：交付时墙构件必须填写哪些字段？'}
        onChange={event => { setQuestion(event.target.value); clearAnswer(); }} />
      {hasSelectedSpreadsheet && <p>提问时可写明工作表名、列名或构件编号。点击回答中的引用可核对工作表和行号。</p>}
      <p>点击提问后，问题与所选资料中检索到的原文片段、文件名和位置会发送给 AI 服务。</p>
      <button className="bv-doc-primary" disabled={busy || !canAsk}>提问</button>
    </form>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="bv-doc-error">{error}</p>}
    {answer && <section className="bv-doc-answer" data-document-answer={answer.sourcesOnly ? undefined : ''} data-document-sources={answer.sourcesOnly ? '' : undefined} aria-live="polite">
      <h3>{answer.sourcesOnly ? '检索到的原文' : '回答'}</h3><p>{answer.text.split(/(\[S\d+\])/g).map((part, index) => {
        const ref = answer.sources.find(item => '[' + item.id + ']' === part);
        return ref ? <button type="button" key={index} aria-label={'查看引用 ' + ref.id}
          aria-expanded={sourceId === ref.id} onClick={() => setSourceId(ref.id)}>{answer.sourcesOnly ? part + ' ' + ref.title + ' · ' + ref.location : part}</button> : part;
      })}</p>
      {currentSource && <article ref={sourcePanel} tabIndex={-1} aria-label={'引用 ' + currentSource.id + ' 原文'}>
        <h4>{currentSource.title} · {currentSource.location}</h4><p>{currentSource.text}</p>
      </article>}
    </section>}
  </>;
}

function AuthenticatedWorkspace({ shareId }: { shareId: string | null }) {
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
  if (owner) return <DocumentWorkspace key={owner + ':' + (shareId || '')} owner={owner} shareId={shareId} checkSession={check} />;
  if (pending) return <p role="status">正在检查登录状态…</p>;
  const loginUrl = '/login?next=' + encodeURIComponent(shareId ? sharePath(shareId) : '/workbench');
  return <div className="bv-doc-login"><p>{shareId ? '请登录后查看共享资料并提问。' : '请登录后添加本机资料并提问。'}登录会在新标签页打开，当前模型会保留。</p>
    <a className="bv-doc-primary" href={loginUrl} target="_blank" rel="noopener noreferrer">登录</a>
    <button type="button" onClick={check}>重新检查登录状态</button></div>;
}

function InteractivePanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const shareId = useSearchParams().get('share');
  const validLink = shareId === null || /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{24}$/.test(shareId);
  useEffect(() => {
    if (shareId !== null && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      setOpen(true);
    }
  }, [shareId]);
  return <>
    <button type="button" className="bv-doc-trigger" aria-haspopup="dialog" onClick={() => {
      dialog.current?.showModal(); setOpen(true);
    }}>项目资料问答</button>
    <dialog className="bv-doc-dialog" aria-label="项目资料问答" ref={dialog} onClose={() => setOpen(false)}>
      <div className="bv-doc-row"><h2>项目资料问答</h2>
        <button type="button" aria-label="关闭项目资料问答" onClick={() => dialog.current?.close()}>关闭</button></div>
      {open && (validLink ? <AuthenticatedWorkspace shareId={shareId} />
        : <p role="alert" className="bv-doc-error">共享链接不完整，请让提供者重新复制完整链接。</p>)}
    </dialog>
  </>;
}

export default function ProjectDocumentsPanel() {
  return <Suspense fallback={<button type="button" className="bv-doc-trigger" disabled>项目资料问答</button>}>
    <InteractivePanel />
  </Suspense>;
}
