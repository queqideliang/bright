// ================================================================
//  上传模态框 — 流式上传到 Speckle，支持拖拽、进度条、状态轮询
//  NOTE: 上传链路：前端 → Next.js API → VPS → Speckle S3
// ================================================================

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useApp } from "@/lib/app-context";
import { IconUpload } from "@/components/icons";
import { S } from "@/lib/constants";
import { ALL_FORMATS, MAX_FILE_SIZE, getFileAcceptString, isAiReady } from "@/lib/supported-formats";
import { createClient } from "@/lib/supabase/client";

/** 最大轮询次数（100 次 × 3 秒 = 5 分钟） */
const MAX_POLL_ATTEMPTS = 100;
const POLL_INTERVAL_MS = 3000;

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; percent: number; fileName: string }
  | { phase: "processing"; name: string; importJobId: string; modelId: string; pollCount: number }
  | { phase: "ready"; name: string }
  | { phase: "failed"; message: string; canRetry: boolean }
  | { phase: "error"; message: string };

export function UploadModal() {
  const { t, setShowUpload, refreshDashboard } = useApp();
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // ── 组件挂载时检查未完成的导入任务 ──
  useEffect(() => {
    const checkPendingImports = async () => {
      try {
        const { data: models } = await supabase
          .from("models")
          .select("id, name, import_job_id, import_status")
          .eq("import_status", "processing")
          .order("created_at", { ascending: false })
          .limit(1);

        if (models && models.length > 0 && models[0].import_job_id) {
          setState({
            phase: "processing",
            name: models[0].name || "未知模型",
            importJobId: models[0].import_job_id,
            modelId: models[0].id,
            pollCount: 0,
          });
        }
      } catch {
        // 静默忽略，不影响正常使用
      }
    };
    checkPendingImports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 轮询 Speckle 导入状态 ──
  useEffect(() => {
    if (state.phase !== "processing") return;

    const { importJobId, pollCount } = state;

    // 超过最大轮询次数
    if (pollCount >= MAX_POLL_ATTEMPTS) {
      setState({
        phase: "failed",
        message: "转换超时（已等待 5 分钟），请稍后刷新页面查看状态",
        canRetry: false,
      });
      return;
    }

    const timer = setInterval(async () => {
      try {
        const resp = await fetch(`/api/import-status/${importJobId}`);
        if (!resp.ok) return;
        const data = await resp.json();

        if (data.status === "ready") {
          clearInterval(timer);
          setState({ phase: "ready", name: state.name });
          refreshDashboard();
        } else if (data.status === "failed") {
          clearInterval(timer);
          setState({
            phase: "failed",
            message: data.error || "Speckle 转换失败，请检查文件格式后重试",
            canRetry: true,
          });
        } else {
          // 仍在处理中，递增轮询计数
          setState((prev) =>
            prev.phase === "processing"
              ? { ...prev, pollCount: prev.pollCount + 1 }
              : prev,
          );
        }
      } catch {
        // 网络错误时继续轮询
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.phase === "processing" ? state.importJobId : null]);

  const onClose = () => {
    if (state.phase === "uploading") return; // 上传中禁止关闭
    setShowUpload(false);
  };

  /**
   * 前端文件校验：扩展名 + 大小
   */
  const validate = (file: File): string | null => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALL_FORMATS.includes(ext)) {
      return `暂不支持 .${ext} 格式`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件大于 50MB，暂时不支持大文件上传。（当前 ${(file.size / 1024 / 1024).toFixed(0)} MB）`;
    }
    return null;
  };

  /**
   * 上传流程：构造 FormData → POST 到 /api/upload-to-speckle → 开始轮询
   */
  const upload = useCallback(async (file: File) => {
    const err = validate(file);
    if (err) { setState({ phase: "error", message: err }); return; }

    setState({ phase: "uploading", percent: 0, fileName: file.name });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectName", file.name.replace(/\.[^.]+$/, ""));

      // 使用 XMLHttpRequest 以支持上传进度
      const result = await new Promise<{
        success: boolean;
        modelId: string;
        importJobId: string;
        name: string;
        error?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload-to-speckle");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState({
              phase: "uploading",
              percent: Math.round((e.loaded / e.total) * 100),
              fileName: file.name,
            });
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
              resolve(data);
            } else {
              reject(new Error(data.error || `上传失败 (${xhr.status})`));
            }
          } catch {
            reject(new Error(`服务器响应异常 (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("网络错误，请检查连接"));
        xhr.ontimeout = () => reject(new Error("上传超时，请稍后重试"));
        xhr.timeout = 600000; // 10 分钟超时

        xhr.send(formData);
      });

      // 上传成功，进入轮询阶段
      setState({
        phase: "processing",
        name: result.name || file.name,
        importJobId: result.importJobId,
        modelId: result.modelId,
        pollCount: 0,
      });
      refreshDashboard();

    } catch (e: unknown) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "未知错误",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDashboard]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    upload(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const isIdle = state.phase === "idle" || state.phase === "error";

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520, background: "#fff", borderRadius: 20,
          padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题行 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: S.colors.text, margin: 0 }}>
            {t.upload_title}
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, color: S.colors.text3, cursor: state.phase === "uploading" ? "not-allowed" : "pointer" }}
          >×</button>
        </div>

        {/* ── 拖拽 / 点击区域（仅 idle / error 时可交互）── */}
        {isIdle && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              padding: "48px 24px", borderRadius: 14, textAlign: "center", cursor: "pointer",
              border: `2px dashed ${dragging ? S.colors.accent : S.colors.border2}`,
              background: dragging ? S.colors.accentLight : S.colors.bg,
              transition: "all .2s",
            }}
          >
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", color: S.colors.text2 }}>
              <IconUpload size={32} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: S.colors.text, marginBottom: 6 }}>
              {t.upload_hint}
            </div>
            <div style={{ fontSize: 12, color: S.colors.text3, lineHeight: 1.6 }}>
              支持 22 种 3D/BIM 格式，最大 50 MB
              <br />
              IFC / RVT / NWC / DWG 等可进行 AI 审计，其他格式仅 3D 查看
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={getFileAcceptString()}
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        )}

        {/* ── 上传进度 ── */}
        {state.phase === "uploading" && (
          <div style={{ padding: "32px 0" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.colors.text, marginBottom: 8 }}>
              正在上传 {state.fileName}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: S.colors.bg3, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                width: `${state.percent}%`, transition: "width .3s",
              }} />
            </div>
            <div style={{ fontSize: 12, color: S.colors.text3 }}>{state.percent}% — 请勿关闭此窗口</div>
          </div>
        )}

        {/* ── Speckle 转换中 ── */}
        {state.phase === "processing" && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>
              <span style={{
                display: "inline-block",
                animation: "spin 1.5s linear infinite",
              }}>⚙️</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: S.colors.text, marginBottom: 4 }}>
              Speckle 正在转换模型…
            </div>
            <div style={{ fontSize: 12, color: S.colors.text3, marginBottom: 16 }}>
              {state.name}
              <br />
              <span style={{ fontSize: 11, color: S.colors.text3 }}>
                已等待 {Math.floor(state.pollCount * 3 / 60)}分{(state.pollCount * 3) % 60}秒，完成前可关闭此窗口
              </span>
            </div>
            {/* 模拟进度：从 10% 到 90% */}
            <div style={{ height: 6, borderRadius: 3, background: S.colors.bg3, overflow: "hidden", marginBottom: 12 }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                width: `${Math.min(10 + state.pollCount * 0.8, 90)}%`,
                transition: "width 2s ease",
              }} />
            </div>
            <button
              onClick={() => setShowUpload(false)}
              style={{
                padding: "8px 24px", borderRadius: 8,
                background: S.colors.accent, color: "#fff",
                border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >关闭</button>
            {/* CSS 旋转动画 */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── 完成 ── */}
        {state.phase === "ready" && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: S.colors.green, marginBottom: 4 }}>模型转换完成</div>
            <div style={{ fontSize: 12, color: S.colors.text3, marginBottom: 16 }}>{state.name}</div>
            <button
              onClick={() => { setShowUpload(false); refreshDashboard(); }}
              style={{
                padding: "8px 24px", borderRadius: 8,
                background: S.colors.green, color: "#fff",
                border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >查看模型</button>
          </div>
        )}

        {/* ── 失败 ── */}
        {state.phase === "failed" && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>❌</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#dc2626", marginBottom: 4 }}>
              模型处理失败
            </div>
            <div style={{ fontSize: 12, color: S.colors.text3, marginBottom: 16, padding: "0 16px" }}>
              {state.message}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {state.canRetry && (
                <button
                  onClick={() => setState({ phase: "idle" })}
                  style={{
                    padding: "8px 24px", borderRadius: 8,
                    background: "transparent", color: "#ef4444",
                    border: "1px solid #ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >重新上传</button>
              )}
              <button
                onClick={() => setShowUpload(false)}
                style={{
                  padding: "8px 24px", borderRadius: 8,
                  background: S.colors.bg3, color: S.colors.text2,
                  border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >关闭</button>
            </div>
          </div>
        )}

        {/* ── 错误（校验失败等） ── */}
        {state.phase === "error" && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 10,
            background: "#fef2f2", color: "#dc2626", fontSize: 13,
          }}>
            ⚠️ {state.message}
            <button
              onClick={() => setState({ phase: "idle" })}
              style={{ marginLeft: 12, background: "none", border: "none", color: S.colors.accent, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            >重试</button>
          </div>
        )}

        {/* 格式说明（仅 idle / error 时显示）*/}
        {isIdle && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: S.colors.accentLight, fontSize: 12, color: S.colors.accent }}>
              <span style={{ fontWeight: 700 }}>✦</span> IFC / RVT / NWC / NWD / DWG / DXF / SKP 等格式：支持 3D 查看 + AI 数据分析
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: S.colors.bg3, fontSize: 12, color: S.colors.text3 }}>
              <span style={{ fontWeight: 700 }}>◇</span> FBX / OBJ / PLY / 3DS / E57 等格式：仅支持 3D 查看
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
