'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Languages, MailCheck } from 'lucide-react';
import { IconGoogle } from '@/components/icons';
import { useApp } from '@/lib/app-context';

const digits = 6;

export function LoginForm({ next, callbackFailed }: { next: string; callbackFailed: boolean }) {
  const { lang, t, loading: sessionLoading, login, signup, verifyOTP, loginWithGoogle, toggleLang } = useApp();
  const zh = lang === 'zh';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login'|'signup'|'verify'>('login');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [code, setCode] = useState<string[]>(Array(digits).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const lock = useRef(false);
  const formId = mode === 'signup' ? t.signup : t.login;
  const busyForm = busy || sessionLoading;
  useEffect(() => {
    if (!countdown) return;
    const timer = setTimeout(() => setCountdown(n => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  useEffect(() => {
    if (mode === 'verify') inputs.current[0]?.focus();
  }, [mode]);

  function changeMode(value: typeof mode) {
    setMode(value); setError(''); setNotice(''); setCode(Array(digits).fill('')); setShowPassword(false);
  }
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); }
    catch { setError(zh ? '暂时无法连接账号服务，请稍后重试。' : 'Unable to reach the account service. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function requestCode() {
    return action(async () => {
      const result = await signup(email.trim(), password, name.trim());
      if (result.error) return setError(result.error);
      if (mode === 'verify') setNotice(zh ? '验证码已重新发送。' : 'A new code was sent.');
      setMode('verify'); setCode(Array(digits).fill('')); setCountdown(60);
    });
  }
  function verify(value: string) {
    if (value.length !== digits) return;
    return action(async () => {
      const result = await verifyOTP(email.trim(), value);
      if (result.error) {
        setError(zh ? '验证码无效或已过期，请检查邮件或重新发送。' : 'This code is invalid or expired. Check your email or request a new code.');
        setCode(Array(digits).fill(''));
        requestAnimationFrame(() => inputs.current[0]?.focus());
      } else router.replace(next);
    });
  }
  function setDigit(index: number, value: string) {
    if (value && !/^\d+$/.test(value)) return;
    const nextCode = [...code];
    const length = Math.min(digits - index, value.length);
    if (!length) nextCode[index] = '';
    for (let i = 0; i < length; i++) nextCode[index + i] = value[i];
    setCode(nextCode);
    if (length) inputs.current[Math.min(digits - 1, index + length)]?.focus();
    if (nextCode.every(Boolean)) void verify(nextCode.join(''));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyForm) return;
    if (mode === 'verify') { void verify(code.join('')); return; }
    if (mode === 'signup') { void requestCode(); return; }
    void action(async () => {
      const result = await login(email.trim(), password);
      if (result.error) {
        const invalid = /invalid login credentials/i.test(result.error);
        setError(zh && invalid ? '邮箱或密码不正确，请重新输入。' : result.error);
      } else router.replace(next);
    });
  }
  return <main className="auth-page"><div className="auth-layout">
    <div className="auth-art" aria-hidden="true">
      <Image src="/images/bim-section.webp" alt="" width={1200} height={800} sizes="(max-width: 780px) 1px, 50vw" />
    </div>
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-utilities"><Link id="btn-back-home" href="/"><ArrowLeft size={15}/>{zh ? '返回首页' : 'Home'}</Link>
        <button id="btn-lang-login" type="button" onClick={toggleLang}><Languages size={15}/>{t.lang}</button></div>
      <div className="auth-heading">
        {mode === 'verify' && <MailCheck size={30} className="auth-mail" />}
        <h1 id="auth-title">{mode === 'verify' ? (zh ? '验证邮箱' : 'Verify your email') : mode === 'signup' ? (zh ? '创建账号' : 'Create an account') : (zh ? '登录账号' : 'Sign in')}</h1>
        <p>{mode === 'verify' ? (zh ? '输入发送至 ' + email + ' 的 6 位验证码。' : 'Enter the 6-digit code sent to ' + email + '.')
          : mode === 'signup' ? (zh ? '使用邮箱注册，保存项目模型与资料。' : 'Register with your email to save models and documents.')
          : (zh ? '使用你的账号继续访问项目。' : 'Use your account to continue to your project.')}</p>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {!error && callbackFailed && mode === 'login' && <div className="auth-error" role="alert">{zh ? '第三方登录未完成，请重新登录。' : 'Sign-in did not complete. Please try again.'}</div>}
      {notice && <div className="auth-notice" role="status">{notice}</div>}
      <form id="form-login" onSubmit={submit}>
        {mode === 'verify' ? <fieldset className="auth-otp"><legend>{zh ? '邮箱验证码' : 'Verification code'}</legend>
          <div>{code.map((value, i) => <input key={i} id={'otp-input-' + i} ref={el => { inputs.current[i] = el; }} aria-label={(zh ? '验证码第 ' : 'Code digit ') + (i+1) + (zh ? ' 位' : '')}
            type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={i === 0 ? 'one-time-code' : 'off'} disabled={busy}
            value={value} onFocus={e => e.target.select()} onChange={e => setDigit(i,e.target.value)}
            onPaste={e => { e.preventDefault(); setDigit(i,e.clipboardData.getData('text').replace(/\s/g,'')); }}
            onKeyDown={e => { if (e.key === 'Backspace' && !value && i) inputs.current[i-1]?.focus(); }}/>
          )}</div></fieldset> : <>
          {mode === 'signup' && <label htmlFor="input-name">{zh ? '姓名' : 'Name'}<input id="input-name" type="text" required autoComplete="name" value={name} disabled={busyForm} onChange={e => setName(e.target.value)} /></label>}
          <label htmlFor="input-email">{t.email}<input id="input-email" type="email" autoComplete="email" placeholder="name@example.com" required disabled={busyForm} value={email} onChange={e => setEmail(e.target.value)} /></label>
          <div className="auth-password"><label htmlFor="input-password">{t.password}</label><div>
            <input id="input-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required minLength={6} disabled={busyForm} value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" disabled={busyForm} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? (zh ? '隐藏密码' : 'Hide password') : (zh ? '显示密码' : 'Show password')} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div></div>
        </>}
        <button id={mode === 'verify' ? 'btn-verify-otp' : 'btn-login-submit'} className="auth-primary" type="submit"
          disabled={busyForm || (mode === 'verify' && code.join('').length !== digits)}>
          {busy ? (zh ? '正在处理…' : 'Please wait…') : mode === 'verify' ? (zh ? '验证并继续' : 'Verify and continue') : formId}<ArrowRight size={17}/></button>
      </form>
      {mode === 'verify' ? <div className="auth-actions">
        <button id="btn-resend-otp" type="button" disabled={busy || countdown > 0} onClick={requestCode}>{countdown ? (zh ? countdown+' 秒后可重发' : 'Resend in '+countdown+'s') : (zh ? '重新发送验证码' : 'Resend code')}</button>
        <button id="btn-back-to-form" type="button" disabled={busy} onClick={() => changeMode('signup')}>{zh ? '修改邮箱' : 'Edit email'}</button>
      </div> : <>
        <div className="auth-or"><span>{zh ? '或' : 'or'}</span></div>
        <button id="btn-login-google" className="auth-google" type="button" disabled={busyForm} onClick={() => void action(async () => {
          const result = await loginWithGoogle(next);
          if (result.error) setError(result.error);
        })}><IconGoogle/>{zh ? '使用 Google 账号继续' : 'Continue with Google'}</button>
        <p className="auth-switch">{mode === 'signup' ? (zh ? '已有账号？' : 'Have an account?') : (zh ? '还没有账号？' : 'New here?')}
          <button type="button" disabled={busy} onClick={() => changeMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? t.login : t.signup}</button></p>
      </>}
    </section>
  </div></main>;
}
