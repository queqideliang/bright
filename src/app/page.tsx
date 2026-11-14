import Link from "next/link";

const features = [
  ["01", "打开模型", "免登录打开 IFC / BV ZIP，模型文件在当前设备解析。"],
  ["02", "查看与核对", "浏览楼层、构件与属性，筛选、隔离、测量和剖切。"],
  ["03", "信息审核", "配置项目必填字段，检查名称与分类信息，查看问题对应的构件。"],
  ["04", "导出结果", "导出审核清单、JSON 数据或通过浏览器打印保存 PDF。"],
];
export default function LandingPage() {
  return <main style={{ minHeight: "100vh", background: "#f4f7fb", color: "#172b45", fontFamily: "system-ui,sans-serif" }}>
    <nav style={{ maxWidth: 1120, margin: "auto", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
      <strong style={{ letterSpacing: ".1em" }}>BRIGHT VISION</strong>
      <Link href="/dashboard" style={{ color: "#185d98", fontSize: 14 }}>账号与已有项目</Link>
    </nav>
    <section style={{ maxWidth: 1120, margin: "auto", padding: "72px 24px 56px" }}>
      <p style={{ color: "#1b7796", letterSpacing: ".16em", fontSize: 13 }}>模型查看 · 信息审核 · 问题定位</p>
      <h1 style={{ fontSize: "clamp(34px,6vw,64px)", lineHeight: 1.18, letterSpacing: "-.04em", maxWidth: 850, margin: "20px 0" }}>看清模型，<br />也看清需要完善的信息。</h1>
      <p style={{ fontSize: 18, lineHeight: 1.9, color: "#52677c", maxWidth: 720 }}>IFC 模型审核与 BRIGHT VISION 在线看模，合并为一个工作台。从打开文件到查看属性、检查问题和导出结果，在同一个页面完成。</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 32 }}>
        <Link href="/workbench" style={{ background: "#173f63", color: "white", borderRadius: 10, padding: "14px 24px", textDecoration: "none", fontWeight: 650 }}>进入模型工作台 ↗</Link>
        <Link href="/dashboard" style={{ background: "white", color: "#173f63", border: "1px solid #cddbe8", borderRadius: 10, padding: "14px 24px", textDecoration: "none" }}>登录查看已有项目</Link>
      </div>
      <p style={{ fontSize: 13, color: "#64798c", marginTop: 20 }}>支持 IFC2X3 / IFC4 STEP 与 BV ZIP · 本机文件体验无需账号</p>
    </section>
    <section style={{ maxWidth: 1120, margin: "auto", padding: "0 24px 56px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16 }}>
      {features.map(([number, title, body]) => <article key={number} style={{ padding: 26, background: "white", border: "1px solid #dce5ec", borderRadius: 16 }}><span style={{ color: "#7891a6", fontSize: 13 }}>{number}</span><h2 style={{ fontSize: 20, marginTop: 24 }}>{title}</h2><p style={{ fontSize: 14, lineHeight: 1.8, color: "#52677c" }}>{body}</p></article>)}
    </section>
    <footer style={{ maxWidth: 1120, margin: "auto", padding: "0 24px 36px", color: "#64798c", fontSize: 13, lineHeight: 1.8 }}>审核按所选规则检查已加载信息，结果包含检查范围。免登录工作台的文件在当前设备处理，不上传保存。原有账号与历史项目入口保留；新工作台的云端保存尚未启用。</footer>
  </main>;
}
