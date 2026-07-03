// ================================================================
//  模型查看 + ISO 19650 合规检查页
//  左侧：3D Speckle Viewer / BIM 数据摘要
//  右侧：Fix-it List 合规检查面板
// ================================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { S } from "@/lib/constants";
import { BimSummary } from "@/components/bim-summary";
import { FixItList } from "@/components/fix-it-list";
import { exportCompliancePDF, captureViewerSnapshot } from "@/lib/export-pdf";
import type { ComplianceReport } from "@/lib/export-pdf";

type IndexStatus = "idle" | "checking" | "extracting" | "ready" | "error";

export default function ViewerPage() {
  const { selectedProject, lang } = useApp();
  const router = useRouter();
  const [indexStatus, setIndexStatus] = useState<IndexStatus>("idle");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [realSpeckleIds, setRealSpeckleIds] = useState<{ streamId?: string; modelId?: string }>({});
  const [parseProgress, setParseProgress] = useState<number>(selectedProject?.progress || 0);

  // 防护：如果没有选中项目，重定向回 dashboard
  useEffect(() => {
    if (!selectedProject || !selectedProject.id) {
      router.replace("/dashboard");
    }
  }, [selectedProject, router]);
  const [isExporting, setIsExporting] = useState(false);
  const progressStartRef = useRef<{ time: number; prog: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // NOTE: Speckle 云端解析引擎支持对这些格式提取构件参数，解析成功后均可进行 AI 审计
  const AI_READY_FORMATS = ["IFC", "RVT", "DWG", "DXF", "3DM", "STEP", "IGES", "E57", "SKP", "NWD", "NWC", "DGN", "SLDPRT", "3DS"];
  const isAnalyzable = AI_READY_FORMATS.includes(selectedProject.format);

  // 优先级：1. 轮询到的真实 ID > 2. 项目自带 ID > 3. 环境变量/演示 ID
  const speckleProjectId = realSpeckleIds.streamId || selectedProject.speckleStreamId || process.env.NEXT_PUBLIC_SPECKLE_PROJECT_ID || "";
  const speckleModelId = realSpeckleIds.modelId || selectedProject.speckleModelId || process.env.NEXT_PUBLIC_SPECKLE_MODEL_ID || "";
  
  // NOTE: 仅当有真实的流 ID 时（非演示 ID 且项目非演示项目），才生成 Viewer URL
  const hasRealSpeckle = !!(realSpeckleIds.streamId || selectedProject.speckleStreamId);
  const viewerUrl = `https://app.speckle.systems/projects/${speckleProjectId}/models/${speckleModelId}#embed=%7B%22isEnabled%22%3Atrue%7D`;

  // NOTE: AI 聊天功能已重构为 Fix-it List 合规检查面板

  // 页面加载时自动触发 VPS 数据提取 + 轮询
  useEffect(() => {
    if (!isAnalyzable) return;

    setIndexStatus("checking");

    const trigger = async () => {
      try {
        const resp = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: String(selectedProject.id),
            speckleProjectId,
            speckleModelId,
          }),
        });
        const data = await resp.json();

        // 如果已经 ready，直接更新状态和摘要
        if (data.status === "ready") {
          setIndexStatus("ready");
          if (data.summary) setSummaryData(data.summary);
          if (data.speckleStreamId) {
             setRealSpeckleIds({ streamId: data.speckleStreamId, modelId: data.speckleModelId });
          }
        }

        // 无论如何都开启轮询（直到解析状态完成并且有 Speckle ID）
        pollRef.current = setInterval(async () => {
          try {
            const pollResp = await fetch(`/api/extract?projectId=${encodeURIComponent(String(selectedProject.id))}`);
            const pollData = await pollResp.json();
            
            // 更新真实进度
            if (typeof pollData.progress === "number" && pollData.progress > 0) {
              setParseProgress(pollData.progress);
              if (!progressStartRef.current) {
                progressStartRef.current = { time: Date.now(), prog: pollData.progress };
              }
            }

            // 更新数据摘要
            if (pollData.summary) {
              setSummaryData(pollData.summary);
            }

            // 检查是否有新生成的 Speckle ID
            if (pollData.speckleStreamId && !realSpeckleIds.streamId) {
              setRealSpeckleIds({ streamId: pollData.speckleStreamId, modelId: pollData.speckleModelId });
            }

            if (pollData.status === "ready") {
              setIndexStatus("ready");
              // 如果 3D 也同步完了，可以停止轮询
              if (pollData.speckleStreamId) {
                 clearInterval(pollRef.current!);
              }
            }
          } catch {
            // 轮询失败静默处理
          }
        }, 3000);
      } catch {
        setIndexStatus("error");
      }
    };

    trigger();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject.id]);


  const handleExportPDF = async (report: ComplianceReport, fixSuggestions: Record<string, string>) => {
    setIsExporting(true);
    const snapshot = await captureViewerSnapshot(iframeRef.current);
    const success = await exportCompliancePDF({
      report,
      projectName: selectedProject.name,
      fixSuggestions,
      snapshotDataUrl: snapshot,
      language: lang,
    });
    if (!success) alert(lang === "zh" ? "PDF 导出失败，请重试。" : "PDF export failed. Please try again.");
    setIsExporting(false);
  };



  return (
    <div id="viewer-container" style={{
      display: "flex", height: "calc(100vh - 104px)",
      borderRadius: 14, overflow: "hidden",
      border: `1px solid ${S.colors.border}`, background: "#fff",
    }}>
      {/* ── 左侧内容区域（3D / 数据摘要） ── */}
      <div style={{ flex: 1, position: "relative", background: "#f1f5f9" }}>
        
        {hasRealSpeckle ? (
          <iframe
            ref={iframeRef}
            key={viewerUrl}
            title="BIM 3D Viewer"
            src={viewerUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="fullscreen"
          />
        ) : (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {indexStatus === "ready" && summaryData ? (
              <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
                <BimSummary data={summaryData} />
                {/* 3D 状态悬浮提示 — 增强版居中展示 */}
                <div style={{
                  position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
                  padding: "16px 30px", borderRadius: 16, background: "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 20px 50px -12px rgba(0,0,0,0.15), 0 10px 15px -8px rgba(0,0,0,0.1)",
                  border: `2px solid ${S.colors.accent}`, display: "flex", alignItems: "center", gap: 16,
                  zIndex: 50, animation: "fadeInUp 0.5s ease-out"
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: S.colors.orange, animation: "pulse 1.2s infinite" }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: S.colors.text }}>3D 渲染视图生成中...</span>
                    <span style={{ fontSize: 12, color: S.colors.text3 }}>云端转换可能需要 1~2 分钟，请稍候</span>
                  </div>
                  <button 
                    id="btn-refresh-3d-status"
                    onClick={() => {
                        setIndexStatus("checking");
                        fetch(`/api/extract?projectId=${encodeURIComponent(String(selectedProject.id))}`)
                          .then(r => r.json())
                          .then(d => {
                            if (d.speckleStreamId) setRealSpeckleIds({ streamId: d.speckleStreamId, modelId: d.speckleModelId });
                            setIndexStatus("ready");
                          });
                    }}
                    style={{
                      marginLeft: 12, padding: "10px 20px", borderRadius: 10, border: "none",
                      background: S.colors.accent, color: "#fff", fontSize: 13, fontWeight: 700, 
                      cursor: "pointer", boxShadow: `0 4px 12px ${S.colors.accent}44`,
                      transition: "transform 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                    onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                  >立即刷新 3D 状态</button>
                </div>
              </div>
            ) : (
               <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: S.colors.text3 }}>
                  <div style={{ fontSize: 48, animation: "spin 3s linear infinite" }}>⚙️</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: S.colors.text }}>AI 正在深度解析模型</div>
                  {/* 进度条 */}
                  <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                    <div style={{ width: "100%", height: 8, borderRadius: 4, background: S.colors.bg3, overflow: "hidden" }}>
                      <div style={{
                        width: `${parseProgress}%`, height: "100%", borderRadius: 4,
                        background: `linear-gradient(90deg, ${S.colors.accent}, ${S.colors.orange})`,
                        transition: "width 1s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.colors.accent }}>{parseProgress}%</div>
                    {/* 预计剩余时间 */}
                    {(() => {
                      const s = progressStartRef.current;
                      if (!s || parseProgress <= s.prog) return null;
                      const elapsed = (Date.now() - s.time) / 1000;
                      const rate = (parseProgress - s.prog) / elapsed;
                      const remaining = Math.round((100 - parseProgress) / rate);
                      if (remaining <= 0 || remaining > 1800) return null;
                      const label = remaining >= 60 ? `约 ${Math.ceil(remaining / 60)} 分钟` : `约 ${remaining} 秒`;
                      return <div style={{ fontSize: 11, color: S.colors.text3 }}>预计剩余 {label}</div>;
                    })()}
                  </div>
                  <div style={{ fontSize: 12, color: S.colors.text3, maxWidth: 300, textAlign: "center", lineHeight: 1.6 }}>
                    数据解析完成后，您可以查看详细的构件统计和楼层信息，3D 视图将在同步完成后自动跳出。
                  </div>
               </div>
            )}
          </div>
        )}

        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6 }}>
          <span style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: "rgba(0,0,0,.6)",
            color: isAnalyzable ? "#10b981" : "#94a3b8", backdropFilter: "blur(8px)",
          }}>
            {selectedProject.format} {isAnalyzable ? "· AI Ready" : "· View Only"}
          </span>
          {!hasRealSpeckle && isAnalyzable && (
            <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: S.colors.orange, color: "#fff", backdropFilter: "blur(8px)" }}>
              Data Mode
            </span>
          )}
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 6 }}>
          <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(0,0,0,.6)", color: "#e2e8f0", backdropFilter: "blur(8px)" }}>
            {selectedProject.name}
          </span>
        </div>
      </div>

      {/* ── 右侧 ISO 19650 合规检查面板 ── */}
      <div style={{ width: 380, minWidth: 380, display: "flex", flexDirection: "column", borderLeft: `1px solid ${S.colors.border}` }}>
        <FixItList
          selectedProject={selectedProject}
          onExportPdf={handleExportPDF}
          isExporting={isExporting}
        />
      </div>
    </div>
  );
}

