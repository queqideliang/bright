'use client';

import Link from 'next/link';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

function fullscreenChanges(update: () => void) {
  document.addEventListener('fullscreenchange', update);
  return () => document.removeEventListener('fullscreenchange', update);
}
const off = () => false;

export function ModelStage({ name, children }: { name: string; children: ReactNode }) {
  const stage = useRef<HTMLElement>(null);
  const available = useSyncExternalStore(fullscreenChanges, () => Boolean(document.fullscreenEnabled), off);
  const full = useSyncExternalStore(fullscreenChanges, () => Boolean(stage.current && document.fullscreenElement === stage.current), off);
  const [notice, setNotice] = useState('');
  async function expand() {
    setNotice('');
    try {
      if (document.fullscreenElement === stage.current) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch { setNotice('浏览器未能切换全屏，请重试。'); }
  }
  return <main className="ml-stage-shell" ref={stage}>
    <header className="ml-stage-bar">
      <Link href="/models"><ArrowLeft size={17}/><span>我的模型库</span></Link>
      <h1 title={name}>{name}</h1>
      {available && <button type="button" onClick={expand} aria-pressed={full}>
        {full ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}<span>{full ? '退出全屏' : '全屏查看'}</span></button>}
    </header>
    {notice && <p role="alert" className="ml-notice ml-error">{notice}</p>}
    {children}
  </main>;
}
