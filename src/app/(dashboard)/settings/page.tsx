'use client';

import Link from 'next/link';
import { useContext, useState, type FormEvent } from 'react';
import { CreditCard, Shield, UserRound } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { createClient } from '@/lib/supabase/client';
import { AccountPlan } from '../plan-context';

export default function SettingsPage() {
  const { user, supabaseUser, lang } = useApp();
  const zh = lang === 'zh';
  const plan = useContext(AccountPlan);
  const [editedName, setEditedName] = useState<string | null>(null);
  const fullName = editedName ?? user?.name ?? '';
  const [password, setPassword] = useState('');
  const [savingName,setSavingName] = useState(false);
  const [savingPassword,setSavingPassword] = useState(false);
  const [nameMessage,setNameMessage] = useState('');
  const [passwordMessage,setPasswordMessage] = useState('');
  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (savingName || !fullName.trim()) return;
    setSavingName(true); setNameMessage('');
    const name = fullName.trim(), client = createClient();
    try {
      const { error } = await client.auth.updateUser({ data: { full_name: name, name } });
      if (error) throw error;
      if (supabaseUser) await client.from('profiles').update({full_name:name}).eq('id',supabaseUser.id);
      setEditedName(name); setNameMessage(zh ? '显示名称已保存。' : 'Display name saved.');
    } catch (err) { setNameMessage(err instanceof Error ? err.message : (zh ? '保存失败，请重试。' : 'Unable to save. Please try again.')); }
    finally { setSavingName(false); }
  }
  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (savingPassword || password.length < 6) return;
    setSavingPassword(true); setPasswordMessage('');
    try {
      const { error } = await createClient().auth.updateUser({password});
      if (error) throw error;
      setPassword(''); setPasswordMessage(zh ? '密码已更新。' : 'Password updated.');
    } catch (err) { setPasswordMessage(err instanceof Error ? err.message : (zh ? '密码更新失败。' : 'Unable to update password.')); }
    finally { setSavingPassword(false); }
  }
  return <><h1>{zh ? '账户设置' : 'Account settings'}</h1><div className="acct-settings">
    <section className="acct-card"><h2><UserRound/>{zh ? '个人信息' : 'Profile'}</h2>
      <p className="acct-email">{user?.email}</p>
      <form onSubmit={saveName}><label htmlFor="account-name">{zh ? '显示名称' : 'Display name'}</label>
        <input id="account-name" autoComplete="name" required disabled={savingName} value={fullName} onChange={e=>setEditedName(e.target.value)}/>
        {nameMessage && <p role="status">{nameMessage}</p>}
        <button className="acct-primary" disabled={savingName || !fullName.trim()}>{savingName ? (zh ? '正在保存…' : 'Saving…') : (zh ? '保存更改' : 'Save changes')}</button>
      </form></section>
    <section className="acct-card"><h2><Shield/>{zh ? '安全设置' : 'Security'}</h2>
      <form onSubmit={savePassword}><label htmlFor="account-password">{zh ? '新密码' : 'New password'}</label>
        <input id="account-password" type="password" autoComplete="new-password" minLength={6} required disabled={savingPassword}
          aria-describedby="password-help" value={password} onChange={e=>setPassword(e.target.value)}/>
        <small id="password-help">{zh ? '至少 6 个字符。' : 'Use at least 6 characters.'}</small>
        {passwordMessage && <p role="status">{passwordMessage}</p>}
        <button className="acct-primary" disabled={savingPassword || !password}>{savingPassword ? (zh ? '正在更新…' : 'Updating…') : (zh ? '更新密码' : 'Update password')}</button>
      </form></section>
    <section className="acct-card acct-subscription"><div><h2><CreditCard/>{zh ? '订阅方案' : 'Subscription'}</h2>
      <p>{plan ? (zh ? '当前方案 · ' : 'Current plan · ')+plan : (zh ? '查看各方案的价格与权益。' : 'Compare plan features and prices.')}</p></div>
      <Link href="/pricing">{zh ? '查看方案' : 'View plans'} →</Link></section>
  </div></>;
}
