import ProductHeader from '@/components/product-header';
import { loginDestination } from '@/lib/login-destination';
import { LoginForm } from './login-form';
import './login.css';

export const metadata = { title: '账号登录 · BRIGHT VISION' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string }> }) {
  const params = await searchParams;
  const next = loginDestination(typeof params.next === 'string' ? params.next : undefined);
  return <><ProductHeader /><LoginForm next={next} callbackFailed={params.error === 'auth_failed'} /></>;
}
