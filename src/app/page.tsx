// ================================================================
//  落地页 (Landing Page) — 完整迁移自 bim-ai-platform.jsx Landing()
// ================================================================

"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";

// 共享按钮样式对象（与原 JSX 保持一致）
const btnPrimary: React.CSSProperties = {
  padding: "8px 18px", borderRadius: 8, border: "none",
  background: "#6366f1", color: "#fff", fontSize: 13,
  fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const btnGhost: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,.2)",
  background: "transparent", fontSize: 12,
  fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};

export default function LandingPage() {
  const { t, toggleLang } = useApp();
  const router = useRouter();

  const goLogin = () => router.push("/login");
  // NOTE: Demo 按钮直接跳转到 viewer，middleware 会检测未登录并重定向到 login
  const goDemo = () => router.push("/viewer");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
        color: "#fff",
        fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
      }}
    >
      {/* ── 顶部导航栏 ── */}
      <nav
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 48px", maxWidth: 1200, margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 14,
            }}
          >
            B
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>{t.brand}</span>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button id="btn-lang-landing" onClick={toggleLang} style={{ ...btnGhost, color: "#a5b4fc", borderColor: "rgba(165,180,252,.3)" }}>
            {t.lang}
          </button>
          <button id="btn-login-nav" onClick={goLogin} style={{ ...btnGhost, color: "#c7d2fe", borderColor: "rgba(199,210,254,.2)" }}>
            {t.login}
          </button>
          <button id="btn-signup-nav" onClick={goLogin} style={{ ...btnPrimary, background: "#6366f1" }}>
            {t.signup}
          </button>
        </div>
      </nav>

      {/* ── Hero 区域 ── */}
      <section style={{ textAlign: "center", padding: "100px 24px 60px", maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-block", padding: "6px 16px", borderRadius: 20,
            background: "rgba(99,102,241,.15)", color: "#a5b4fc",
            fontSize: 13, fontWeight: 600, marginBottom: 24,
            border: "1px solid rgba(99,102,241,.2)",
          }}
        >
          ✨ Powered by Claude AI + Speckle
        </div>

        <h1
          style={{
            fontSize: 56, fontWeight: 800, lineHeight: 1.1,
            letterSpacing: "-0.03em", margin: "0 0 20px",
          }}
        >
          {t.hero1}
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8, #c084fc, #f472b6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {t.hero2}
          </span>
        </h1>

        <p style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 40px" }}>
          {t.heroSub}
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <button
            id="btn-cta-primary"
            onClick={goLogin}
            style={{ ...btnPrimary, padding: "14px 32px", fontSize: 15, background: "#6366f1", borderRadius: 12 }}
          >
            {t.cta}
          </button>
          <button
            id="btn-cta-demo"
            onClick={goDemo}
            style={{ ...btnGhost, padding: "14px 32px", fontSize: 15, color: "#c7d2fe", borderColor: "rgba(199,210,254,.3)", borderRadius: 12 }}
          >
            {t.ctaDemo}
          </button>
        </div>
      </section>

      {/* ── 数字统计 ── */}
      <div style={{ display: "flex", justifyContent: "center", gap: 60, padding: "40px 0 80px" }}>
        {([["128K+", t.statModels], ["500+", t.statUsers], ["< 10s", t.statTime]] as [string, string][]).map(([v, l], i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 36, fontWeight: 800,
                background: "linear-gradient(135deg, #818cf8, #c084fc)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              {v}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── 核心功能卡片 ── */}
      <div
        style={{
          maxWidth: 1000, margin: "0 auto", padding: "0 24px 100px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
        }}
      >
        {([
          [t.feat1t, t.feat1d, "📦"],
          [t.feat2t, t.feat2d, "🤖"],
          [t.feat3t, t.feat3d, "🔗"],
          [t.feat4t, t.feat4d, "🔒"],
        ] as [string, string, string][]).map(([title, desc, em], i) => (
          <div
            key={i}
            style={{
              padding: 28, borderRadius: 16,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.06)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>{em}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* ── 页脚 ── */}
      <footer
        style={{
          textAlign: "center", padding: "32px 24px",
          borderTop: "1px solid rgba(255,255,255,.06)",
          color: "#475569", fontSize: 13,
        }}
      >
        © 2026 brightsunliang.top · {t.tagSub}
      </footer>
    </div>
  );
}
