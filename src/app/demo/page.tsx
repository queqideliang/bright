// ================================================================
//  免登陆演示页面 — 展示 sample compliance report
// ================================================================

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { S } from "@/lib/constants";

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    // 5秒后自动关闭演示，引导登陆
    const timer = setTimeout(() => {
      showMessage();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const showMessage = () => {
    const confirmed = confirm(
      "演示报告会在登陆后完整显示。现在登陆体验完整功能？\n\nThe full interactive report requires login. Sign up now to try it out?"
    );
    if (confirmed) {
      router.push("/login");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${S.colors.dark} 0%, ${S.colors.dark3} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* 演示报告头部 */}
        <div
          style={{
            background: `linear-gradient(135deg, ${S.colors.accent} 0%, #8b5cf6 100%)`,
            color: "#fff",
            padding: "40px 30px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px" }}>
            BIM Compliance Audit Report
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            Sample Report — ISO 19650-2:2021
          </p>
        </div>

        {/* 演示内容 */}
        <div style={{ padding: "40px 30px" }}>
          {/* 合规分数卡 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
            <div style={{ padding: 20, borderRadius: 12, background: S.colors.bg, border: `1px solid ${S.colors.border}` }}>
              <div style={{ fontSize: 12, color: S.colors.text3, fontWeight: 600, marginBottom: 8 }}>
                COMPLIANCE SCORE
              </div>
              <div style={{ fontSize: 42, fontWeight: 800, color: S.colors.green, marginBottom: 8 }}>
                82%
              </div>
              <div style={{ fontSize: 12, color: S.colors.text2 }}>
                ✓ 通过 | 7 个问题需修复
              </div>
            </div>
            <div style={{ padding: 20, borderRadius: 12, background: S.colors.bg, border: `1px solid ${S.colors.border}` }}>
              <div style={{ fontSize: 12, color: S.colors.text3, fontWeight: 600, marginBottom: 8 }}>
                TOTAL ELEMENTS
              </div>
              <div style={{ fontSize: 42, fontWeight: 800, color: S.colors.accent, marginBottom: 8 }}>
                2,847
              </div>
              <div style={{ fontSize: 12, color: S.colors.text2 }}>
                Elements analyzed in 3 minutes
              </div>
            </div>
          </div>

          {/* 类别汇总 */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: S.colors.text }}>
              Check Summary
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: S.colors.bg3 }}>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600, color: S.colors.text2 }}>
                    Category
                  </th>
                  <th style={{ padding: 12, textAlign: "center", fontWeight: 600, color: S.colors.red }}>
                    Errors
                  </th>
                  <th style={{ padding: 12, textAlign: "center", fontWeight: 600, color: S.colors.orange }}>
                    Warnings
                  </th>
                  <th style={{ padding: 12, textAlign: "center", fontWeight: 600, color: S.colors.green }}>
                    Passed
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: `1px solid ${S.colors.border}` }}>
                  <td style={{ padding: 12, fontWeight: 600 }}>Naming Convention</td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.red, fontWeight: 700 }}>
                    3
                  </td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.orange }}>2</td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.green, fontWeight: 700 }}>
                    2,842
                  </td>
                </tr>
                <tr style={{ borderTop: `1px solid ${S.colors.border}`, background: S.colors.bg }}>
                  <td style={{ padding: 12, fontWeight: 600 }}>Uniclass 2015</td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.red }}>0</td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.orange, fontWeight: 700 }}>
                    4
                  </td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.green, fontWeight: 700 }}>
                    2,843
                  </td>
                </tr>
                <tr style={{ borderTop: `1px solid ${S.colors.border}` }}>
                  <td style={{ padding: 12, fontWeight: 600 }}>EIR Properties</td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.red }}>1</td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.orange }}>1</td>
                  <td style={{ padding: 12, textAlign: "center", color: S.colors.green, fontWeight: 700 }}>
                    2,845
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 样本问题 */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: S.colors.text }}>
              Sample Issues (complete list in full report)
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  severity: "ERROR",
                  type: "Wall",
                  issue: "Naming convention violation: Expected format [Project]-[Originator]-[Vol]-[Level]-[Type]-[Role]-[Number]",
                  current: "Wall_01",
                },
                {
                  severity: "WARNING",
                  type: "Door",
                  issue: "Missing Uniclass 2015 classification code",
                  current: "—",
                },
              ].map((issue, i) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${S.colors.border}`,
                    background: issue.severity === "ERROR" ? S.colors.redBg : S.colors.orangeBg,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: issue.severity === "ERROR" ? S.colors.red : S.colors.orange,
                        color: "#fff",
                      }}
                    >
                      {issue.severity}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        {issue.type}: {issue.issue}
                      </div>
                      <div style={{ fontSize: 11, color: S.colors.text3 }}>
                        Current: <code>{issue.current}</code>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: S.colors.accentLight,
              textAlign: "center",
              border: `1px solid ${S.colors.accent}`,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: S.colors.accent, margin: "0 0 12px" }}>
              This is just a preview
            </h3>
            <p style={{ fontSize: 13, color: S.colors.text2, marginBottom: 16 }}>
              Sign up for free to upload your own models, get full compliance reports with AI-generated fix recommendations,
              and download PDF reports compliant with BS EN ISO 19650-2:2021.
            </p>
            <button
              onClick={() => router.push("/login")}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                background: S.colors.accent,
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </div>

      {/* 底部提示 */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          right: 20,
          padding: 16,
          borderRadius: 8,
          background: "rgba(255,255,255,0.95)",
          border: `1px solid ${S.colors.border}`,
          fontSize: 12,
          color: S.colors.text2,
          textAlign: "center",
        }}
      >
        Demo will close in 5 minutes. <button
          onClick={() => router.push("/login")}
          style={{
            background: "none",
            border: "none",
            color: S.colors.accent,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "inherit",
            fontFamily: "inherit",
          }}
        >
          Sign up now
        </button> to upload your first model.
      </div>
    </div>
  );
}
