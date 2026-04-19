// ================================================================
//  工作台 — 从 Supabase 加载真实数据，无数据时显示演示数据
// ================================================================

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { IconUpload, IconAudit, IconExport } from "@/components/icons";
import { S, DEMO_PROJECTS } from "@/lib/constants";
import type { Project, SupabaseProject } from "@/lib/types";

/** 将 Supabase 数据库格式转换为前端 Project 格式 */
function mapSupabaseToProject(sp: SupabaseProject): Project[] {
  if (!sp.models || sp.models.length === 0) {
    return [{
      id: sp.id, name: sp.name, format: "IFC",
      elements: 0, status: "PENDING", progress: 0,
      date: sp.created_at.slice(0, 10),
      isModel: false,
    }];
  }
  return sp.models.map((m) => ({
    id: m.id,
    name: m.name || sp.name,
    format: m.file_type,
    elements: m.element_count || 0,
    status: m.status === "COMPLETED" ? "done" : m.status === "PARSING" ? "parsing" : m.status === "AUDITING" ? "auditing" : "PENDING",
    progress: m.progress || 0,
    date: (m.updated_at || m.created_at).slice(0, 10),
    speckleStreamId: m.speckle_stream_id || undefined,
    speckleModelId: m.speckle_model_id || undefined,
    isModel: true,
    importJobId: m.import_job_id || undefined,
    importStatus: m.import_status || undefined,
  }));
}

export default function DashboardPage() {
  const { t, setShowUpload, setSelectedProject, dashboardRefreshKey, refreshDashboard } = useApp();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [stats, setStats] = useState({ totalProjects: 4, totalElements: 6549, auditsDone: 2, completeness: 87 });
  const [dataSource, setDataSource] = useState<"demo" | "live">("demo");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 尝试从 Supabase 加载真实数据
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const resp = await fetch("/api/projects", { cache: "no-store" });
        if (!resp.ok) return;
        const data = await resp.json();

        if (data.projects && data.projects.length > 0) {
          const mapped = data.projects.flatMap(mapSupabaseToProject);
          setProjects(mapped);
          setStats(data.stats);
          setDataSource("live");
        }
        // 无数据时保持演示数据
      } catch {
        // API 不可用时保持演示数据
      }
    };
    loadProjects();
  }, [dashboardRefreshKey]);

  const handleViewProject = (p: Project) => {
    setSelectedProject(p);
    router.push("/viewer");
  };

  const handleDeleteItem = async (p: Project) => {
    if (confirmDeleteId !== p.id) {
      setConfirmDeleteId(p.id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    setConfirmDeleteId(null);
    
    // 🔥 乐观删除：立刻从本地 React 状态中移除，不再苦等网络和缓存同步
    const previousProjects = projects;
    setProjects((old) => old.filter((item) => item.id !== p.id));
    
    try {
      const endpoint = p.isModel === false
        ? `/api/projects/${p.id}`
        : `/api/models/${p.id}`;
      
      console.log("Deleting via endpoint:", endpoint);
      const resp = await fetch(endpoint, { method: "DELETE" });
      
      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Delete failed with status:", resp.status, errText);
        throw new Error("Delete failed");
      }
      
      console.log("Delete successful in backend!");
      // 后台静默刷新状态
      refreshDashboard();
      router.refresh(); 
    } catch (e) {
      console.error("Delete exception caught:", e);
      // 网络或后方抛出异常则回滚乐观状态
      setProjects(previousProjects);
      alert("删除请求已发送，但服务器响应异常，如刷新后重复出现请检查系统状态");
    }
  };

  const quickActions = [
    { label: t.dash_upload, Icon: IconUpload, color: S.colors.accent, bg: S.colors.accentLight, action: () => setShowUpload(true) },
    { label: t.dash_audit, Icon: IconAudit, color: S.colors.green, bg: S.colors.greenBg, action: null },
    { label: t.dash_export, Icon: IconExport, color: S.colors.blue, bg: S.colors.blueBg, action: null },
  ] as const;

  const statsData = [
    { val: String(stats.totalProjects), label: t.stat_total_projects, color: S.colors.accent },
    { val: stats.totalElements.toLocaleString(), label: t.stat_elements, color: S.colors.green },
    { val: String(stats.auditsDone), label: t.stat_audits_done, color: S.colors.blue },
    { val: `${stats.completeness}%`, label: t.stat_completeness, color: S.colors.orange },
  ];

  const statusColors: Record<string, [string, string]> = {
    parsing: [S.colors.orange, S.colors.orangeBg],
    auditing: [S.colors.blue, S.colors.blueBg],
    done: [S.colors.green, S.colors.greenBg],
    view_only: [S.colors.text3, S.colors.bg3],
    PENDING: [S.colors.text3, S.colors.bg3],
    PARSING: [S.colors.orange, S.colors.orangeBg],
    AUDITING: [S.colors.blue, S.colors.blueBg],
    COMPLETED: [S.colors.green, S.colors.greenBg],
    FAILED: [S.colors.red, S.colors.redBg],
  };

  // 状态文本映射
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      parsing: t.status_parsing, auditing: t.status_auditing,
      done: t.status_done, view_only: t.status_view_only,
      PENDING: t.lang === "ZH" ? "待处理" : "Pending",
      PARSING: t.status_parsing, AUDITING: t.status_auditing,
      COMPLETED: t.status_done, FAILED: t.lang === "ZH" ? "解析失败" : "Failed",
    };
    return map[status] || status;
  };

  return (
    <div>
      {/* 数据来源提示 */}
      {dataSource === "demo" && (
        <div style={{
          padding: "8px 14px", borderRadius: 8, background: S.colors.orangeBg,
          color: S.colors.orange, fontSize: 12, marginBottom: 16,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          ⚡ {t.lang === "EN" ? "当前显示演示数据。上传模型后将显示真实项目。" : "Showing demo data. Upload models to see real projects."}
        </div>
      )}

      {/* 快速操作 */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: S.colors.text, margin: "0 0 14px" }}>{t.dash_quick}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
        {quickActions.map(({ label, Icon, color, bg, action }, i) => (
          <button key={i} id={`btn-quick-${i}`} onClick={action ?? undefined}
            style={{
              display: "flex", alignItems: "center", gap: 14, padding: "20px",
              borderRadius: 14, background: "#fff", border: `1px solid ${S.colors.border}`,
              cursor: action ? "pointer" : "default", textAlign: "left",
              fontFamily: "inherit", transition: "border-color .15s",
            }}
            onMouseOver={(e) => { if (action) e.currentTarget.style.borderColor = color; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = S.colors.border; }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color }}>
              <Icon size={20} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: S.colors.text }}>{label}</div>
          </button>
        ))}
      </div>

      {/* 本月统计 */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: S.colors.text, margin: "0 0 14px" }}>{t.dash_stats}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
        {statsData.map(({ val, label, color }, i) => (
          <div key={i} style={{ padding: 20, borderRadius: 14, background: "#fff", border: `1px solid ${S.colors.border}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{val}</div>
            <div style={{ fontSize: 12, color: S.colors.text3, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 项目表格 */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: S.colors.text, margin: "0 0 14px" }}>{t.dash_active}</h2>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${S.colors.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: S.colors.bg3 }}>
              {[t.col_project, t.col_format, t.col_elements, t.col_status, t.col_date, ""].map((h, i) => (
                <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: S.colors.text2, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => {
              const [sc, sb] = statusColors[p.status] ?? [S.colors.text3, S.colors.bg3];
              const isAI = ["IFC", "RVT", "DWG", "DXF", "3DM", "STEP", "IGES", "E57", "SKP", "NWD", "NWC", "DGN", "SLDPRT", "3DS"].includes(p.format);
              return (
                <tr key={i} style={{ borderTop: `1px solid ${S.colors.border}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: S.colors.text }}>{p.name}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: isAI ? S.colors.accentLight : S.colors.bg3, color: isAI ? S.colors.accent : S.colors.text3 }}>{p.format}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: S.colors.text2 }}>{p.elements > 0 ? p.elements.toLocaleString() : "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: sb, color: sc }}>{statusLabel(p.status)}</span>
                      {(p.status === "parsing" || p.status === "PARSING" || p.status === "auditing" || p.status === "AUDITING") && (
                        <div style={{ flex: 1, maxWidth: 80, height: 4, borderRadius: 2, background: S.colors.bg3 }}>
                          <div style={{ width: `${p.progress}%`, height: "100%", borderRadius: 2, background: p.status.includes("pars") || p.status === "PARSING" ? S.colors.orange : S.colors.blue, transition: "width 1s" }} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: S.colors.text3, fontSize: 12 }}>{p.date}</td>
                  <td style={{ padding: "12px 16px", display: "flex", gap: 6 }}>
                    <button id={`btn-view-project-${p.id}`} onClick={() => handleViewProject(p)}
                      style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6, border: `1px solid ${S.colors.accentLight}`, background: "transparent", color: S.colors.accent, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
                    >{t.view}</button>
                    {dataSource === "live" && (
                      <button onClick={() => handleDeleteItem(p)}
                        style={{ padding: "5px 10px", fontSize: 11, borderRadius: 6, border: confirmDeleteId === p.id ? `1px solid ${S.colors.red}` : `1px solid ${S.colors.redBg}`, background: confirmDeleteId === p.id ? S.colors.red : "transparent", color: confirmDeleteId === p.id ? "#fff" : S.colors.red, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
                      >{confirmDeleteId === p.id ? "确认删除?" : "删除"}</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
