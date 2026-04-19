// ================================================================
//  左侧固定导航栏 — 参考 Autodesk Build Dashboard 扁平图标设计
// ================================================================

"use client";

import { useRouter, usePathname } from "next/navigation";
import { IconDashboard, IconViewer, IconPricing, IconSettings, IconLogout } from "@/components/icons";
import { useApp } from "@/lib/app-context";
import { S } from "@/lib/constants";

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "nav_dash" as const, Icon: IconDashboard },
  { href: "/viewer",    labelKey: "nav_viewer" as const, Icon: IconViewer },
  { href: "/pricing",   labelKey: "nav_pricing" as const, Icon: IconPricing },
  { href: "/settings",  labelKey: "nav_settings" as const, Icon: IconSettings },
];

export function Sidebar() {
  const { t, logout } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: "#fff",
        borderRight: `1px solid ${S.colors.border}`,
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo 区域 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 32 }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 13, color: "#fff",
          }}
        >
          B
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: S.colors.text, letterSpacing: "-0.01em" }}>{t.brand}</div>
          <div style={{ fontSize: 10, color: S.colors.text3, marginTop: -1 }}>{t.tagSub}</div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(({ href, labelKey, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <button
              key={href}
              id={`nav-${href.slice(1)}`}
              onClick={() => router.push(href)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                width: "100%", textAlign: "left",
                background: isActive ? S.colors.accentLight : "transparent",
                color: isActive ? S.colors.accent : S.colors.text2,
                transition: "all .15s",
                fontFamily: "inherit",
              }}
            >
              <Icon size={18} />
              {t[labelKey]}
            </button>
          );
        })}
      </nav>

      {/* 退出登录 */}
      <button
        id="btn-logout"
        onClick={handleLogout}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px", borderRadius: 8,
          border: `1px solid ${S.colors.border}`,
          background: "transparent", cursor: "pointer",
          fontSize: 13, color: S.colors.text3,
          fontFamily: "inherit", transition: "all .15s",
        }}
      >
        <IconLogout size={16} />
        {t.logout}
      </button>
    </aside>
  );
}
