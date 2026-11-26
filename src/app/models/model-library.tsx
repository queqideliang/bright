'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Box, ChevronDown, CloudUpload, FileBox, FolderOpen, LoaderCircle, Search, Settings, Upload } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { libraryExtensions, libraryFormats, libraryMaxBytes, modelExtension, modelKind, type LibraryItem } from '@/lib/model-library/formats';

function displaySize(bytes: number) {
  return bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' KiB' : (bytes / 1024 ** 2).toFixed(1) + ' MiB';
}

async function jsonResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '请求失败，请重试。');
  return body;
}

function sendFile(url: string, file: File, progress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('文件未能存入模型库，请重试。'));
    xhr.onerror = () => reject(new Error('上传连接中断，请检查网络后重试。'));
    xhr.ontimeout = () => reject(new Error('上传超时，请重试。'));
    xhr.timeout = 600000;
    xhr.send(file);
  });
}

export function ModelLibrary({ reviewing = false }: { reviewing?: boolean }) {
  const router = useRouter();
  const { loading: sessionLoading } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [reading, setReading] = useState(true);
  const [listError, setListError] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState('');
  const visible = items.filter(item => (!reviewing || modelKind(item.name) !== 'geometry')
    && item.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const detailUrl = (id: string) => '/models/' + id + (reviewing ? '?tool=review' : '');

  async function refresh(offset: number, signal?: AbortSignal) {
    setReading(true); setListError('');
    try {
      const result = await jsonResponse(await fetch('/api/library?offset=' + offset, { cache: 'no-store', signal }));
      if (signal?.aborted) return;
      setItems(current => offset ? [...new Map([...current, ...result.items].map(item => [item.id, item])).values()] : result.items);
      setNext(result.nextOffset);
    } catch (err) {
      if (!signal?.aborted) setListError(err instanceof Error ? err.message : '模型列表读取失败。');
    } finally { if (!signal?.aborted) setReading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(0, controller.signal);
    return () => controller.abort();
  }, []);

  async function upload(file?: File) {
    if (!file || uploadLock.current || sessionLoading) return;
    setError('');
    if (reviewing && modelKind(file.name) === 'geometry') { setError('模型审核需要 IFC 或 BV ZIP 文件。'); return; }
    if (!libraryExtensions.includes(modelExtension(file.name))) { setError('此格式尚未接入。请查看下方支持的格式。'); return; }
    if (!file.size || file.size > libraryMaxBytes) { setError('请选择非空且不超过 50 MiB 的文件。'); return; }
    uploadLock.current = true;
    try {
      setProgress('正在校验 ' + file.name);
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      const sha256 = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const model = await jsonResponse(await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, sha256 }) }));
      if (!model.saved) {
        const url = new URL(model.signedUrl);
        if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) throw new Error('上传地址无效。');
        try { await sendFile(url.href, file, value => setProgress('正在上传 ' + value + '%')); }
        catch (err) {
          // A concurrent upload or lost response may have completed the same immutable object.
          const check = await fetch('/api/library/' + model.id + '/viewer', { cache: 'no-store' });
          if (!check.ok) throw err;
        }
      }
      setProgress('已保存，正在打开模型…');
      setItems(current => [{ id: model.id, name: file.name, size: file.size, createdAt: new Date().toISOString() }, ...current.filter(item => item.id !== model.id)]);
      router.push(detailUrl(model.id));
      uploadLock.current = false; setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试。');
      setProgress(''); uploadLock.current = false;
    } finally { if (input.current) input.current.value = ''; }
  }

  return <main className="ml-page"><div className="ml-container">
    <header className="ml-title"><div className="ml-title-row"><h1>{reviewing ? '选择审核模型' : '我的模型库'}</h1>
      <Link href="/settings" className="ml-account"><Settings size={16}/>账户设置</Link></div>
      <p>{reviewing ? '选择已保存的 IFC 或 BV ZIP，也可以上传新的模型进行审核。' : '保存项目模型，随时在浏览器中打开。'}</p></header>
    <section className={'ml-upload' + (dragging ? ' is-dragging' : '')} aria-labelledby="ml-upload-title"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files[0]); }}>
      <div className="ml-upload-main">
        <div className="ml-upload-icon"><CloudUpload size={33} strokeWidth={1.5} aria-hidden="true" /></div>
        <div className="ml-upload-copy"><h2 id="ml-upload-title">{dragging ? '松开以上传模型' : '添加模型文件'}</h2>
          <p>拖入文件，或从设备中选择。单个文件最大 50 MiB。</p></div>
        <button className="ml-primary" disabled={sessionLoading || !!progress} onClick={() => input.current?.click()}>
          {progress ? <LoaderCircle size={18} className="ml-spin" /> : <Upload size={18} />}上传模型</button>
        <input ref={input} id="library-file" type="file" hidden disabled={sessionLoading || !!progress} accept={reviewing ? '.ifc,.zip' : libraryExtensions.map(ext => '.' + ext).join(',')} onChange={e => void upload(e.target.files?.[0])} />
      </div>
      {progress && <p className="ml-notice" role="status"><LoaderCircle size={15} className="ml-spin" />{progress}</p>}
      {error && <p className="ml-notice ml-error" role="alert">{error}</p>}
      <details className="ml-formats"><summary><span>支持的格式与文件要求</span><ChevronDown size={15} /></summary>
        <p>{reviewing ? '审核支持 IFC、BV ZIP。' : libraryFormats.map(([name]) => name).join('、') + '。'}</p>
        <p>Revit 模型请先导出 IFC 或 BV ZIP。{!reviewing && 'glTF 需内嵌资源，也可导出 GLB。单文件 OBJ 可查看几何。'}</p>
      </details>
    </section>
    <section className="ml-list" aria-labelledby="ml-saved-title">
      <div className="ml-list-bar"><h2 id="ml-saved-title">已保存的模型</h2>
        {!!items.length && <label className="ml-filter"><Search size={17}/><input type="search" aria-label="筛选已加载模型" placeholder="筛选已加载模型" value={filter} onChange={e => setFilter(e.target.value)} /></label>}
      </div>
      {listError && <div className="ml-notice ml-error" role="alert">{listError} <button onClick={() => void refresh(0)}>重新加载</button></div>}
      {!items.length && !listError && <div className="ml-empty" role="status">
        {reading ? <LoaderCircle className="ml-spin" /> : <FolderOpen size={32} strokeWidth={1.5} />}
        <h3>{reading ? '正在读取模型…' : '模型库里还没有文件'}</h3>{!reading && <p>上传第一个模型后，它会出现在这里。</p>}
      </div>}
      {!!items.length && !visible.length && <div className="ml-empty" role="status"><Search size={26}/><h3>{reviewing && !filter ? '已加载的文件里没有 IFC 或 BV ZIP' : '没有匹配的模型'}</h3>{filter && <button onClick={() => setFilter('')}>清除筛选</button>}</div>}
      {!!visible.length && <>
        <div className="ml-columns" aria-hidden="true"><span>文件名</span><span>大小</span><span>保存日期</span><span/></div>
        <ul className="ml-files">{visible.map(item => {
          const extension = modelExtension(item.name);
          const date = Date.parse(item.createdAt);
          return <li key={item.id}><Link href={detailUrl(item.id)}>
            <span className="ml-file-name"><span className="ml-file-icon">{['ifc','zip'].includes(extension) ? <Box size={22}/> : <FileBox size={22}/>}</span>
              <span><strong>{item.name}</strong><small>{extension === 'zip' ? 'BV ZIP' : extension.toUpperCase()}</small></span>
            </span><span className="ml-size">{displaySize(item.size)}</span><span className="ml-date">{Number.isFinite(date) ? new Intl.DateTimeFormat('zh-CN').format(date) : '—'}</span>
            <span className="ml-open"><span>{reviewing ? '打开审核' : '打开模型'}</span><ArrowRight size={16}/></span>
          </Link></li>;
        })}</ul></>}
      {next !== null && <div className="ml-pagination"><button disabled={reading} onClick={() => void refresh(next)}>{reading ? '正在加载…' : '加载更多模型'}</button></div>}
    </section>
  </div></main>;
}
