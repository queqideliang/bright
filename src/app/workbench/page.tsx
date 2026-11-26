import ProductHeader from '@/components/product-header';
import ProjectDocumentsPanel from './project-documents-panel';

export const metadata = { title: '看模工作台 · BRIGHT VISION' };

type Query = Record<string, string | string[] | undefined>;

export default async function WorkbenchPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const viewerParams = new URLSearchParams();
  if (typeof query.tool === 'string' && ['quantity', 'review', 'export'].includes(query.tool)) {
    viewerParams.set('tool', query.tool);
  }
  if (query.demo === '1') viewerParams.set('demo', '1');
  const viewerQuery = viewerParams.toString();
  return <div className="bv-workbench-shell">
    <ProductHeader active="workbench"><ProjectDocumentsPanel /></ProductHeader>
    <main aria-label="模型查看与审核" className="bv-workbench-frame">
      <iframe src={'/bim-viewer/index.html' + (viewerQuery ? '?' + viewerQuery : '')}
        title="BRIGHT VISION 模型查看与审核工作台" allow="fullscreen" referrerPolicy="no-referrer" />
    </main>
  </div>;
}
