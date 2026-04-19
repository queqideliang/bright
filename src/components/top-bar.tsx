// ================================================================
//  顶部全局工具栏 — 项目选择器 / 语言切换 / 用户头像
// ================================================================

"use client";

import { useApp } from "@/lib/app-context";
import { S } from "@/lib/constants";

export function TopBar() {
  const { t, user, toggleLang } = useApp();

  return (
    <header
      style={{
        height: 56,
        minHeight: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        background: "#fff",
        borderBottom: `1px solid ${S.colors.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* 左侧：欢迎语 */}
      <div style={{ fontSize: 13, color: S.colors.text3 }}>
        {t.dash_welcome},{" "}
        <span style={{ color: S.colors.text, fontWeight: 600 }}>
          {user?.name ?? "User"}
        </span>
      </div>

      {/* 右侧：语言切换 + 头像 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          id="btn-lang-toggle"
          onClick={toggleLang}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: `1px solid ${S.colors.border}`,
            background: "transparent",
            fontSize: 12,
            fontWeight: 500,
            color: S.colors.text2,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t.lang}
        </button>

        {/* 用户头像（初版为首字母头像，后期接 Supabase Auth） */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
          title={user?.email}
        >
          {user?.name?.[0] ?? "U"}
        </div>
      </div>
    </header>
  );
}
