import Link from 'next/link';
import { redirect } from 'next/navigation';
import ProductHeader from '@/components/product-header';
import { createClient } from '@/lib/supabase/server';
import { archiveDate, archiveId, archivePage, readArchiveReport, reportsPerPage, reportsUrl } from '@/lib/archive-report';
import ReportDetails from './report-details';
import './reports.css';

export const metadata = { title: '历史审核报告 · BRIGHT VISION' };
type Query = Record<string,string | string[] | undefined>;
type Client = Awaited<ReturnType<typeof createClient>>;

async function ArchiveList({ client, owner, page }: { client: Client; owner: string; page: number }) {
  const start = (page-1)*reportsPerPage;
  const { data, error } = await client.from('models')
    .select('id,name,projects!inner(user_id),checked_at:audit_json->>checkedAt')
    .eq('projects.user_id',owner).not('audit_json','is',null).neq('audit_json','{}')
    .order('updated_at',{ascending:false,nullsFirst:false}).order('id').range(start,start+reportsPerPage);
  const rows = data?.slice(0,reportsPerPage) ?? [];
  return <section className="report-sheet">
    <header className="report-heading"><h1>历史审核报告</h1>
      <Link href="/workbench?tool=review" className="report-action">审核模型</Link></header>
    {error ? <p role="alert">暂时无法读取历史审核报告。请稍后重新打开此页。</p> :
      rows.length ? <ul className="report-list">{rows.map(row=><li key={row.id}>
        <Link href={reportsUrl(page,row.id)} prefetch={false}>{row.name}</Link>
        <span>{row.checked_at ? archiveDate(row.checked_at) : '审核时间未记录'}</span>
      </li>)}</ul> : <p>{page===1 ? '当前账号还没有已保存的历史审核报告。' : '本页没有历史审核报告。'}</p>}
    {(!error && (page>1 || (data?.length ?? 0)>reportsPerPage)) && <nav className="report-pages" aria-label="报告列表分页">
      {page>1 && <Link href={reportsUrl(page-1)}>上一页</Link>}
      <span>第 {page} 页</span>
      {(data?.length ?? 0)>reportsPerPage && <Link href={reportsUrl(page+1)}>下一页</Link>}
    </nav>}
  </section>;
}

async function ArchivedModel({client,owner,id}: {client:Client; owner:string; id:string}) {
  if (!archiveId.test(id)) return <p className="report-sheet" role="alert">报告链接无效。</p>;
  const {data,error} = await client.from('models')
    .select('name,audit_json,projects!inner(user_id)').eq('projects.user_id',owner).eq('id',id).maybeSingle();
  if (error) return <p className="report-sheet" role="alert">暂时无法读取该报告，请稍后重试。</p>;
  if (!data) return <p className="report-sheet" role="alert">报告不存在，或当前账号没有查看权限。</p>;
  if (!data.audit_json) return <p className="report-sheet">此模型没有保存历史审核报告。</p>;
  const report = readArchiveReport(data.audit_json,data.name);
  return report ? <ReportDetails key={id} report={report}/> : <p className="report-sheet">这份历史记录没有可读取的审核结果。</p>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const page = archivePage(query.page);
  const id = typeof query.model === 'string' ? query.model : undefined;
  const client = await createClient();
  const {data:{user}} = await client.auth.getUser();
  if (!user) redirect('/login?next='+encodeURIComponent(reportsUrl(page,id)));
  return <><ProductHeader active="review"/><main className="reports-main">
    {id !== undefined ? <><Link className="report-back" href={reportsUrl(page)}>返回历史报告列表</Link>
      <ArchivedModel client={client} owner={user.id} id={id}/></> : <ArchiveList client={client} owner={user.id} page={page}/>}
  </main></>;
}
