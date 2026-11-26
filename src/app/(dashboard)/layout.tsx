'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CreditCard, Languages, LogOut, Settings } from 'lucide-react';
import ProductHeader from '@/components/product-header';
import { useApp } from '@/lib/app-context';
import { createClient } from '@/lib/supabase/client';
import './account.css';
import { AccountPlan } from './plan-context';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, supabaseUser, loading, lang, t, toggleLang, logout } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const leaving = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<{ id: string; value: string } | null>(null);
  const accountId = supabaseUser?.id;
  const zh = lang === 'zh';
  useEffect(() => {
    if (!loading && !user && !leaving.current) router.replace('/login?next='+encodeURIComponent(pathname));
  }, [loading, user, router, pathname]);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    void createClient().from('profiles').select('plan').eq('id',accountId).abortSignal(controller.signal).maybeSingle().then(({data,error}) => {
      if (!controller.signal.aborted && !error && data?.plan) setPlan({id:accountId,value:String(data.plan).toUpperCase()});
    });
    return () => controller.abort();
  }, [accountId]);
  async function signOut() {
    if (leaving.current) return;
    leaving.current = true; setSigningOut(true); setMessage('');
    try { await logout(); router.replace('/'); }
    catch { leaving.current = false; setSigningOut(false); setMessage(zh ? '退出失败，请重试。' : 'Sign-out failed. Please try again.'); }
  }
  return <><ProductHeader/><main className="acct-page"><div className="acct-container">
    {loading || !user ? <p role="status">{zh ? '正在检查登录状态…' : 'Checking account…'}</p> : <>
      <div className="acct-tools"><nav aria-label={zh ? '账户导航' : 'Account navigation'}>
        <Link id="nav-settings" aria-current={pathname === '/settings' ? 'page' : undefined} href="/settings"><Settings/>{zh ? '账户设置' : 'Settings'}</Link>
        <Link id="nav-pricing" aria-current={pathname === '/pricing' ? 'page' : undefined} href="/pricing"><CreditCard/>{zh ? '方案与价格' : 'Plans'}</Link>
      </nav><div><button id="btn-lang-toggle" type="button" onClick={toggleLang}><Languages/>{t.lang}</button>
        <button id="btn-logout" type="button" onClick={signOut} disabled={signingOut}><LogOut/>{t.logout}</button></div></div>
      {message && <p role="alert">{message}</p>}
      <AccountPlan.Provider value={plan?.id === accountId ? plan?.value ?? null : null}>{children}</AccountPlan.Provider>
    </>}
  </div></main></>;
}
