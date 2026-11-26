import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';

const destinations = [
  { key: 'home', title: '工作概览', href: '/' },
  { key: 'models', title: '模型库', href: '/models' },
  { key: 'workbench', title: '看模工作台', href: '/workbench' },
] as const;

export default function ProductHeader({ active, children }: {
  active?: typeof destinations[number]['key'];
  children?: ReactNode;
}) {
  return <header className="bv-product-header">
    <div className="bv-product-header-inner">
      <Link className="bv-product-brand" href="/" aria-label="BRIGHT VISION 首页">
        <img src="/brand-mark.svg" alt="" width="39" height="39" />
        <span><strong lang="en">BRIGHT VISION</strong><small>BIM 工程平台</small></span>
      </Link>
      <nav className="bv-product-nav" aria-label="主导航">
        {destinations.map(item => <Link key={item.key} href={item.href}
          aria-current={item.key === active ? 'page' : undefined}>{item.title}</Link>)}
      </nav>
      <div className="bv-header-action">{children ?? <Link href="/workbench?tool=documents" className="bv-header-docs">
        <BookOpen size={16} aria-hidden="true" />项目 AI 问答
      </Link>}</div>
    </div>
  </header>;
}
