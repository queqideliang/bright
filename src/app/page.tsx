import Link from 'next/link';
import { ArrowRight, Box, Boxes, ClipboardCheck, FolderOpen, Play, Ruler, MessagesSquare } from 'lucide-react';
import ProductHeader from '@/components/product-header';
import './home.css';

const tools = [
  { href: '/workbench?tool=export', name: '模型导出', icon: Boxes, description: '从 Revit 导出 BV 模型包，或将已打开的模型转换为 GLB、SCV。' },
  { href: '/workbench?tool=quantity', name: '工程算量', icon: Ruler, description: '按楼层、类别核对构件数量和工程量，导出明细。' },
  { href: '/workbench?tool=review', name: '模型审核', icon: ClipboardCheck, description: '检查命名、分类和交付属性，定位问题并下载 PDF 审核报告。' },
] as const;

export default function HomePage() {
  return <div className="bv-home">
    <ProductHeader active="home" />
    <main className="bv-home-main">
      <section className="bv-home-hero" aria-labelledby="home-title">
        <div className="bv-hero-copy">
          <h1 id="home-title">BIM 模型工作台</h1>
          <p>从模型导出、工程量核对到信息审核，<br className="bv-wide-break" />在一个工作台完成。</p>
          <div className="bv-hero-actions">
            <Link href="/workbench" className="bv-action-primary"><FolderOpen size={19} aria-hidden="true" />打开本机模型</Link>
            <Link href="/workbench?demo=1" className="bv-action-text"><Play size={15} aria-hidden="true" />体验演示模型</Link>
          </div>
          <span className="bv-format-hint">IFC / BV ZIP<span aria-hidden="true">·</span>本机查看，无需登录</span>
        </div>
        <figure className="bv-hero-figure">
          <img src="/images/bim-section.webp" alt="建筑剖切示意，可见楼板、结构柱及机电管线" width="1200" height="800" fetchPriority="high" />
          <figcaption><Box size={13} aria-hidden="true" />建筑剖切示意</figcaption>
        </figure>
      </section>
      <section className="bv-home-tools" aria-labelledby="home-tools">
        <h2 id="home-tools">工程工具</h2>
        <div className="bv-home-tool-grid">
          {tools.map(({href, name, icon: Icon, description}) => <Link key={href} href={href} className="bv-home-tool">
            <div className="bv-home-tool-top"><Icon size={25} strokeWidth={1.65} aria-hidden="true" /><ArrowRight size={18} aria-hidden="true" /></div>
            <h3>{name}</h3><p>{description}</p>
          </Link>)}
        </div>
      </section>
      <section className="bv-home-docs">
        <MessagesSquare aria-hidden="true" size={27} strokeWidth={1.65} />
        <div><h2>项目 AI 问答</h2><p>结合模型工程量、交底文件和现场资料提问，核对数字和出处。</p></div>
        <Link href="/workbench?tool=documents">打开问答 <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    </main>
  </div>;
}
