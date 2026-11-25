'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadCloudModel } from '@/lib/model-library/download';

export function GeometryView({ id }: { id: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('正在准备查看器…');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'bv-geometry-loaded') setStatus('');
      if (event.data?.type === 'bv-geometry-error') { setStatus(''); setError(event.data.message); }
    }
    window.addEventListener('message', receive);
    setError(''); setStatus('正在下载模型…');
    downloadCloudModel(id, { signal: controller.signal, storageOrigin: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin,
      onProgress: (n, total) => setStatus('正在下载模型 ' + Math.floor(100 * n / total) + '%') }).then(file => {
      if (controller.signal.aborted) return;
      setStatus('正在解析模型…');
      frame.current?.contentWindow?.postMessage({ type: 'bv-open-geometry', file }, location.origin);
    }).catch(err => { if (!controller.signal.aborted) { setStatus(''); setError(err instanceof Error ? err.message : '文件读取失败。'); } });
    return () => { controller.abort(); window.removeEventListener('message', receive); };
  }, [id, ready, attempt]);
  return <div className="bv-stage">
    <iframe key={attempt} ref={frame} onLoad={() => setReady(true)} className="bv-frame" src="/cloud-model-viewer/index.html" title="三维模型" allow="fullscreen" referrerPolicy="no-referrer" />
    {status && <div className="bv-feedback" role="status">{status}</div>}
    {error && <div className="bv-feedback bv-error" role="alert">{error} <button onClick={() => { setReady(false); setError(''); setAttempt(n => n + 1); }}>重新打开</button></div>}
  </div>;
}
