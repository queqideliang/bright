'use client';

import { useEffect, useState } from 'react';
import { parseModelFact } from '@/lib/project-model-evidence';
import type { Passage } from '@/lib/project-documents';

export type EvidenceDocument = { title: string; kind?: 'model'; passages: (Passage & { fact?: NonNullable<ReturnType<typeof parseModelFact>> })[] };
export type ModelChoice = { document: EvidenceDocument | null; pending: boolean; error?: string };
export type LibraryModel = { id: string; name: string };

function readEvidence(value: unknown): EvidenceDocument {
  if (!value || typeof value !== 'object' || !('title' in value) || typeof value.title !== 'string'
    || !('passages' in value) || !Array.isArray(value.passages) || !value.passages.length) {
    throw new Error('未读取到模型统计，请重新选择模型。');
  }
  const passages = value.passages.map(p => {
    if (!p || typeof p.location !== 'string' || typeof p.text !== 'string') throw new Error('模型统计格式无效。');
    const fact = parseModelFact(p.fact);
    if (p.fact != null && !fact) throw new Error('模型工程量格式无效，请重新读取。');
    return {location:p.location, text:p.text, ...(fact ? {fact} : {})};
  });
  return {kind:'model', title:value.title, passages};
}

export default function ModelSourcePicker({ initialModel, disabled, onChange }: {
  initialModel?: LibraryModel; disabled: boolean; onChange: (state: ModelChoice) => void;
}) {
  const [selection, setSelection] = useState(initialModel ? (/\.(zip|ifc)$/i.test(initialModel.name) ? initialModel.id : 'none') : 'current');
  const [library, setLibrary] = useState<LibraryModel[]>([]);
  const [offset, setOffset] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [listError, setListError] = useState('');
  const [listBusy, setListBusy] = useState(true);
  const [listVersion, setListVersion] = useState(0);
  const [version, setVersion] = useState(0);
  const [choice, setChoice] = useState<ModelChoice>({document:null, pending:true});

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/library?offset='+offset, {cache:'no-store',signal:controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error('模型库列表暂时无法读取。');
        const body = await response.json();
        if (controller.signal.aborted) return;
        const items: LibraryModel[] = body.items.filter((m: LibraryModel) => /\.(zip|ifc)$/i.test(m.name));
        setLibrary(old => offset ? [...old, ...items.filter(item => !old.some(m => m.id === item.id))] : items);
        setNext(body.nextOffset ?? null);
      }).catch(() => { if (!controller.signal.aborted) setListError('模型库列表暂时无法读取。'); })
      .finally(() => { if (!controller.signal.aborted) setListBusy(false); });
    return () => controller.abort();
  }, [offset, listVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const publish = (state: ModelChoice) => {
      if (!controller.signal.aborted) { setChoice(state); onChange(state); }
    };
    const fail = (cause: unknown) => publish({document:null,pending:false,error:cause instanceof Error ? cause.message : '模型暂时无法读取。'});
    if (selection === 'none') { publish({document:null,pending:false}); return; }
    publish({document:null,pending:true});
    if (selection !== 'current') {
      fetch('/api/workbench/model-sources/'+encodeURIComponent(selection), {cache:'no-store',signal:controller.signal})
        .then(async response => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || '暂时无法读取所选云端模型。');
          publish({document:readEvidence(body.document),pending:false});
        }).catch(fail);
      return () => controller.abort();
    }
    const frame = document.querySelector<HTMLIFrameElement>('iframe[data-bv-project-viewer]');
    if (!frame) { publish({document:null,pending:false}); return; }
    let requestId = '';
    let timer: ReturnType<typeof setTimeout>;
    function request() {
      clearTimeout(timer);
      requestId = crypto.randomUUID();
      publish({document:null,pending:true});
      frame?.contentWindow?.postMessage({type:'bv:project-qa:request',requestId}, window.location.origin);
      timer = setTimeout(() => fail(new Error('当前模型尚未就绪。可重读模型，或选「仅使用资料」。')), 25_000);
    }
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
      const body = event.data;
      if (body?.type === 'bv:project-qa:changed') { request(); return; }
      if (body?.type !== 'bv:project-qa:response' || body.requestId !== requestId) return;
      clearTimeout(timer);
      if (body.error) { fail(new Error(String(body.error))); return; }
      try { publish({document:body.document == null ? null : readEvidence(body.document),pending:false}); }
      catch (error) { fail(error); }
    }
    window.addEventListener('message',receive);
    frame.addEventListener('load',request);
    request();
    return () => {
      controller.abort(); clearTimeout(timer); frame.removeEventListener('load',request); window.removeEventListener('message',receive);
    };
  }, [selection, version, onChange]);

  const entries = initialModel && /\.(zip|ifc)$/i.test(initialModel.name) && !library.some(m => m.id === initialModel.id)
    ? [initialModel,...library] : library;
  return <section className="bv-doc-model" aria-label="模型数据来源">
    <label htmlFor="project-model-source">模型</label>
    <select id="project-model-source" value={selection} disabled={disabled} onChange={e => {
      onChange({document:null,pending:true}); setSelection(e.target.value);
    }}>
      <option value="current">当前工作台模型</option>
      <option value="none">仅使用资料</option>
      {entries.length > 0 && <optgroup label="我的模型库">{entries.map(item =>
        <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
    </select>
    {choice.pending ? <p role="status">正在读取模型统计…</p> : choice.error ?
      <p role="alert" className="bv-doc-error">{choice.error} <button type="button" disabled={disabled} onClick={() => setVersion(n => n+1)}>重读模型</button></p> :
      choice.document ? <p data-model-source-ready>已选模型：{choice.document.title}</p> :
      selection === 'current' && <p>当前没有可查询的模型。可以先添加资料，或从上方选择模型库文件。</p>}
    {listError && <p>{listError} <button type="button" disabled={listBusy} onClick={() => { setListError('');setListBusy(true);setListVersion(n => n+1); }}>重读列表</button></p>}
    {next !== null && <button type="button" disabled={listBusy} onClick={() => { setListError('');setListBusy(true);setOffset(next); }}>更多模型</button>}
  </section>;
}
