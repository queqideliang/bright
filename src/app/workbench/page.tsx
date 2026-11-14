import Link from "next/link";

export const metadata = { title: "模型查看与审核 · BRIGHT VISION" };

export default function WorkbenchPage() {
  return <main style={{ height: "100dvh", minHeight: 600, display: "flex", flexDirection: "column", background: "#f4f7fb", color: "#172b45" }}>
    <header style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 16, padding: "12px 20px", borderBottom: "1px solid #dce4ec", background: "white" }}>
      <Link href="/" style={{ fontWeight: 800, letterSpacing: ".08em", textDecoration: "none", color: "inherit" }}>BRIGHT VISION</Link>
      <span style={{ fontSize: 13 }}>模型查看与审核</span>
      <span style={{ fontSize: 12, color: "#52677c" }}>打开本机 IFC / BV ZIP，文件在当前设备处理</span>
      <Link href="/dashboard" style={{ marginLeft: "auto", fontSize: 13 }}>账号与已有项目</Link>
    </header>
    <iframe src="/bim-viewer/index.html" title="BRIGHT VISION 模型查看与审核工作台" allow="fullscreen" referrerPolicy="no-referrer" style={{ flex: 1, minHeight: 0, width: "100%", border: 0 }} />
  </main>;
}
