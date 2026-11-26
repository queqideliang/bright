'use client';

import { useState } from 'react';
import { archiveDate, type ArchiveReport } from '@/lib/archive-report';

export default function ReportDetails({ report }: { report: ArchiveReport }) {
  const [exporting,setExporting] = useState(false);
  const [error,setError] = useState('');
  const [page,setPage] = useState(0);
  const pageSize = 30;
  async function download() {
    setError(''); setExporting(true);
    try {
      const url = '/review-report/export.mjs';
      const { downloadReviewPdf } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
      await downloadReviewPdf(report);
    } catch {
      setError('PDF 下载失败，请重试。');
    } finally { setExporting(false); }
  }
  return <article className="report-sheet">
    <header className="report-heading"><div><p>历史审核报告</p><h1>{report.modelName}</h1></div>
      <button className="report-action" type="button" disabled={exporting} onClick={download}>{exporting ? '正在生成 PDF…' : '下载 PDF'}</button></header>
    {error && <p role="alert">{error}</p>}
    <dl className="report-facts">
      <div><dt>审核时间</dt><dd title={report.checkedAt}>{archiveDate(report.checkedAt)}</dd></div>
      <div><dt>模型构件数</dt><dd>{report.totalElements ?? '未记录'}</dd></div>
      <div><dt>审核评分</dt><dd>{report.score ?? '未记录'}</dd></div>
    </dl>
    {report.scope && <p className="report-note">{report.scope}</p>}
    <h2>分类摘要</h2>
    {report.summaries.length ? <div className="report-table"><table><thead><tr>
      {['分类','问题','错误','警告','通过'].map(col=><th key={col} scope="col">{col}</th>)}
    </tr></thead><tbody>{report.summaries.map((s,i)=><tr key={i}><th scope="row">{s.label}</th>
      {[s.total,s.errors,s.warnings,s.passed].map((v,i)=><td key={i}>{v ?? '未记录'}</td>)}</tr>)}</tbody></table></div>
      : <p>原报告未保存分类摘要。</p>}
    <h2>问题明细</h2>
    {report.issues.length ? <><p>已保存 {report.issues.length} 项</p><ol className="report-issues" start={page*pageSize+1}>
      {report.issues.slice(page*pageSize,(page+1)*pageSize).map((issue,i)=><li key={i}>
        <strong>{[issue.category,issue.severity,issue.field].filter(Boolean).join(' · ')}</strong>
        {issue.message && <p>{issue.message}</p>}
        <dl>{[['构件 ID',issue.elementId],['构件类型',issue.elementName],['原值',issue.actual],
          ['预期',issue.expected],['整改建议',issue.suggestion]].map(([k,v])=>v === undefined ? null :
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </li>)}
    </ol>{report.issues.length > pageSize && <nav className="report-pages" aria-label="问题明细分页">
      <button disabled={page===0} onClick={()=>setPage(page-1)}>上一页明细</button><span>第 {page+1} / {Math.ceil(report.issues.length/pageSize)} 页</span>
      <button disabled={(page+1)*pageSize>=report.issues.length} onClick={()=>setPage(page+1)}>下一页明细</button>
    </nav>}</> : <p>{report.scope.includes('未保存问题明细') ? '无可显示的明细。' : '留存的问题明细为空。'}</p>}
  </article>;
}
