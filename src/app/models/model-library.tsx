'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { libraryExtensions, libraryFormats, libraryMaxBytes, modelExtension, type LibraryItem } from '@/lib/model-library/formats';

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

export function ModelLibrary() {
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
    if (!file || uploadLock.current) return;
    setError('');
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
      router.push('/models/' + model.id);
      uploadLock.current = false; setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试。');
      setProgress(''); uploadLock.current = false;
    } finally { if (input.current) input.current.value = ''; }
  }

  return <main className="bv-library">
    <header className="bv-bar"><Link href="/">BRIGHT VISION</Link><Link href="/dashboard">项目工作台</Link></header>
    <section className="bv-shelf">
      <h1>我的模型库</h1><p>上传后直接查看。用同一账号登录，可以继续打开已保存的模型。</p>
      <div className={'bv-upload' + (dragging ? ' dragging' : '')} onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files[0]); }}>
        <button className="bv-primary" disabled={sessionLoading || !!progress} onClick={() => input.current?.click()}>上传模型</button>
        <input ref={input} id="library-file" type="file" hidden disabled={sessionLoading || !!progress} accept={libraryExtensions.map(ext => '.' + ext).join(',')} onChange={e => void upload(e.target.files?.[0])} />
        <span>或拖入一个文件 · 单个文件最大 50 MiB</span>
        <details><summary>支持的格式与文件要求</summary><p>{libraryFormats.map(([name]) => name).join('、')}。glTF 请内嵌资源或导出 GLB。OBJ 单文件可查看几何。Revit 模型可先导出 IFC 或 BV ZIP。</p></details>
      </div>
      {progress && <p role="status">{progress}</p>}{error && <p className="bv-error" role="alert">{error}</p>}
      <h2>已保存的模型</h2>
      {listError && <p role="alert" className="bv-error">{listError} <button onClick={() => void refresh(0)}>重新加载</button></p>}
      {!items.length && !listError && <p>{reading ? '正在读取模型…' : '模型库里还没有文件。上传第一个模型后，会显示在这里。'}</p>}
      <ul className="bv-files">{items.map(item => <li key={item.id}><Link href={'/models/' + item.id}>
        <strong>{item.name}</strong><span>{displaySize(item.size)}</span><span>打开模型</span>
      </Link></li>)}</ul>
      {next !== null && <button disabled={reading} onClick={() => void refresh(next)}>加载更多模型</button>}
    </section>
  </main>;
}
