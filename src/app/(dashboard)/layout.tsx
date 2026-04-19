// ================================================================
//  已认证页面共享布局 — Sidebar + TopBar + Auth 守卫
// ================================================================

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { UploadModal } from "@/components/upload-modal";
import { useApp } from "@/lib/app-context";
import { S } from "@/lib/constants";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, showUpload } = useApp();
  const router = useRouter();

  // NOTE: 双重守卫 — middleware 在服务端拦截，这里在客户端再校验一次
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // 加载中时显示骨架屏
  if (loading) {
    return (
      <div style={{
        display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
        background: S.colors.bg, fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 16, color: "#fff", margin: "0 auto 12px",
          }}>B</div>
          <div style={{ fontSize: 13, color: S.colors.text3 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{
      display: "flex", height: "100vh",
      background: S.colors.bg,
      fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
      overflow: "hidden",
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar />
        <main style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
          {children}
        </main>
      </div>
      {showUpload && <UploadModal />}
    </div>
  );
}
