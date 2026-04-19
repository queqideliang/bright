// ================================================================
//  设置页 (Settings Page) — 暂为占位符，后续接入 Supabase 用户管理
// ================================================================

"use client";

import { useApp } from "@/lib/app-context";
import { S } from "@/lib/constants";

export default function SettingsPage() {
  const { t, user } = useApp();

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: S.colors.text, margin: "0 0 24px" }}>
        {t.nav_settings}
      </h1>

      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${S.colors.border}`, padding: 28 }}>
        {/* 用户信息行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 24, borderBottom: `1px solid ${S.colors.border}` }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 22, fontWeight: 700,
            }}
          >
            {user?.name?.[0] ?? "U"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: S.colors.text }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: S.colors.text3, marginTop: 2 }}>{user?.email}</div>
          </div>
          <div
            style={{
              marginLeft: "auto", padding: "4px 12px", borderRadius: 20,
              background: S.colors.accentLight, color: S.colors.accent,
              fontSize: 11, fontWeight: 700,
            }}
          >
            FREE
          </div>
        </div>

        {/* TODO: 接入 Supabase Auth 后完善账号设置、订阅管理、API Key 等功能 */}
        <div style={{ paddingTop: 24, fontSize: 13, color: S.colors.text3, textAlign: "center" }}>
          {t.lang === "EN" ? "更多设置功能即将推出..." : "More settings coming soon..."}
        </div>
      </div>
    </div>
  );
}
