'use client';

import { Check } from 'lucide-react';
import { useContext, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { AccountPlan } from '../plan-context';

const plans = [
  { id:'free', price:'$0', name:['免费版','Free'], period:['',''], features:[
    ['每月 3 次合规检查','3 compliance checks / month'],['文件命名校验（ISO 19650）','File naming validation (ISO 19650)'],
    ['基础 Uniclass 2015 检查','Basic Uniclass 2015 check'],['社区支持','Community support']] },
  { id:'pro', price:'$99', name:['专业版 Pro','Pro'], period:[' / 月',' / month'], features:[
    ['不限次数的合规检查','Unlimited compliance checks'],['完整 Uniclass 2015 校验','Full Uniclass 2015 validation'],
    ['EIR 属性完整性检查','EIR property completeness check'],['AI 修复指南（含 Revit 步骤）','AI Fix-it Guide (Revit steps)'],
    ['导出 PDF 审核报告','PDF audit report export'],['优先支持','Priority support']] },
  { id:'project', price:'$499', name:['单项目版','Per Project'], period:[' / 项目',' / project'], features:[
    ['每个项目一次付费','One-time payment per project'],['包含专业版全部权益','Everything in Pro'],
    ['无需订阅','No subscription commitment'],['可分享的 PDF 报告','Shareable PDF report'],
    ['BIM 协调人交接资料包','BIM coordinator handover pack'],['邮件支持','Email support']] },
] as const;

export default function PricingPage() {
  const { lang } = useApp();
  const zh = lang === 'zh', index = zh ? 0 : 1;
  const current = useContext(AccountPlan);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  async function checkout(plan: 'pro'|'project') {
    if (pending) return;
    setPending(plan); setError('');
    try {
      const response = await fetch('/api/lemon/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan})});
      const body = await response.json();
      if (!response.ok || !body.checkoutUrl) throw new Error('Checkout unavailable');
      window.location.assign(body.checkoutUrl);
    } catch { setPending(''); setError(zh ? '结账服务暂不可用，请稍后重试。' : 'Checkout is unavailable. Please try again.'); }
  }
  return <><h1>{zh ? '方案与价格' : 'Plans and pricing'}</h1>
    <div className="acct-plans">{plans.map(plan => {
      const active = current === plan.id.toUpperCase();
      const action = active ? (zh ? '当前方案' : 'Current plan') : plan.id === 'free' ? (zh ? '免费方案' : 'Free plan')
        : plan.id === 'pro' ? (zh ? '选择专业版' : 'Get Pro') : (zh ? '选择单项目版' : 'Buy Project');
      return <section key={plan.id} className={'acct-card acct-plan'+(plan.id==='pro'?' acct-pro':'')} id={'pricing-card-'+plan.id}>
        <h2>{plan.name[index]}</h2><p className="acct-price"><strong>{plan.price}</strong>{plan.period[index]}</p>
        <ul>{plan.features.map(feature=><li key={feature[1]}><Check aria-hidden="true"/>{feature[index]}</li>)}</ul>
        <button id={'btn-pricing-cta-'+plan.id} className={plan.id==='pro'?'acct-primary':'acct-secondary'}
          disabled={active || plan.id === 'free' || Boolean(pending)} onClick={()=>{if(plan.id !== 'free') void checkout(plan.id);}}>
          {pending===plan.id ? (zh ? '正在转到结账…' : 'Opening checkout…') : action}</button>
      </section>;
    })}</div>
    {error && <p role="alert">{error}</p>}
    <p className="acct-contact">{zh ? '需要定制方案？联系 ' : 'For a custom plan, contact '}<a href="mailto:me@brightsunliang.top">me@brightsunliang.top</a></p>
  </>;
}
