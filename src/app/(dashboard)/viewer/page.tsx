// ================================================================
//  模型查看 + AI 审计页 — 真实 AI API + 动态 Speckle Viewer
// ================================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "@/lib/app-context";
import { IconSend } from "@/components/icons";
import { S } from "@/lib/constants";
import type { ChatMessage, Project } from "@/lib/types";
import { BimSummary } from "@/components/bim-summary";

type IndexStatus = "idle" | "checking" | "extracting" | "ready" | "error";

export default function ViewerPage() {
  const { t, selectedProject, setSelectedProject } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus>("idle");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [realSpeckleIds, setRealSpeckleIds] = useState<{ streamId?: string; modelId?: string }>({});
  
  const chatRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // NOTE: Speckle 云端解析引擎支持对这些格式提取构件参数，解析成功后均可进行 AI 审计
  const AI_READY_FORMATS = ["IFC", "RVT", "DWG", "DXF", "3DM", "STEP", "IGES", "E57", "SKP", "NWD", "NWC", "DGN", "SLDPRT", "3DS"];
  const isAnalyzable = AI_READY_FORMATS.includes(selectedProject.format);

  // 优先级：1. 轮询到的真实 ID > 2. 项目自带 ID > 3. 环境变量/演示 ID
  const speckleProjectId = realSpeckleIds.streamId || selectedProject.speckleStreamId || process.env.NEXT_PUBLIC_SPECKLE_PROJECT_ID || "";
  const speckleModelId = realSpeckleIds.modelId || selectedProject.speckleModelId || process.env.NEXT_PUBLIC_SPECKLE_MODEL_ID || "";
  
  // NOTE: 仅当有真实的流 ID 时（非演示 ID 且项目非演示项目），才生成 Viewer URL
  const hasRealSpeckle = !!(realSpeckleIds.streamId || selectedProject.speckleStreamId);
  const viewerUrl = `https://app.speckle.systems/projects/${speckleProjectId}/models/${speckleModelId}#embed=%7B%22isEnabled%22%3Atrue%7D`;

  /** 发送消息到真实 AI API */
  const send = useCallback(async () => {
    const q = input.trim();
    if (!q) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setTyping(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          projectId: String(selectedProject.id),
          modelId: String(selectedProject.id), // selectedProject.id 是模型 UUID
        }),
      });

      if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`);
      }

      const data = await resp.json();
      const reply = data.answer || (t.lang === "EN"
        ? "抱歉，AI 暂时无法回答此问题。"
        : "Sorry, AI cannot answer this question right now.");

      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      console.error("AI chat error:", err);
      const errorMsg = t.lang === "EN"
        ? "⚠️ AI 服务暂时不可用，请稍后再试。"
        : "⚠️ AI service temporarily unavailable. Please try again later.";
      setMessages((prev) => [...prev, { role: "ai", text: errorMsg }]);
    } finally {
      setTyping(false);
    }
  }, [input, selectedProject.id, t.lang]);

  // 快捷问题发送函数
  const sendQuickQuestion = useCallback(async (q: string) => {
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setTyping(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: q, 
          projectId: String(selectedProject.id),
          modelId: String(selectedProject.id), // selectedProject.id 是模型 UUID
        }),
      });
      const data = await resp.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.answer || "无法回答" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "⚠️ AI 服务暂时不可用" }]);
    } finally {
      setTyping(false);
    }
  }, [selectedProject.id]);

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
            
            // 更新进度
            if (pollData.progress) {
               // 联动更新外部 context 的项目信息（可选）
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

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages, typing]);

  const quickQuestions = [t.q1, t.q2, t.q3];

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 104px)",
      borderRadius: 14, overflow: "hidden",
      border: `1px solid ${S.colors.border}`, background: "#fff",
    }}>
      {/* ── 左侧内容区域（3D / 数据摘要） ── */}
      <div style={{ flex: 1, position: "relative", background: "#f1f5f9" }}>
        
        {hasRealSpeckle ? (
          <iframe
            key={viewerUrl} // ID 变动时重载 iframe
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
                  <div style={{ fontSize: 13, background: S.colors.bg3, padding: "8px 20px", borderRadius: 20 }}>解析进度：{indexStatus === "checking" ? "10%" : "正在提取属性及生成 3D 视图..."}</div>
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

      {/* ── 右侧 AI 审计面板 ── */}
      <div style={{ width: 380, minWidth: 380, display: "flex", flexDirection: "column", borderLeft: `1px solid ${S.colors.border}` }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${S.colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isAnalyzable ? S.colors.green : S.colors.text3 }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: S.colors.text }}>{t.viewer_ai}</span>
          </div>
          <span style={{ fontSize: 11, color: S.colors.text3 }}>Gemini + Speckle Sync</span>
        </div>

        {/* 消息区域 */}
        <div ref={chatRef} style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {!isAnalyzable ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: S.colors.text3 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{t.viewer_fbx_note}</div>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏗️</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: S.colors.text, marginBottom: 6 }}>{t.viewer_ai}</div>
              <div style={{ fontSize: 12, color: S.colors.text3, lineHeight: 1.6 }}>{t.viewer_ai_ready}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 20 }}>
                {quickQuestions.map((q, i) => (
                  <button key={i} id={`btn-quick-q-${i}`}
                    onClick={() => sendQuickQuestion(q)}
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: `1px solid ${S.colors.border}`,
                      background: "transparent", fontSize: 12, color: S.colors.text2,
                      cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all .15s",
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = S.colors.accentLight; e.currentTarget.style.color = S.colors.accent; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = S.colors.text2; }}
                  >{q}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 8, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                    background: m.role === "ai" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : S.colors.bg3,
                    color: m.role === "ai" ? "#fff" : S.colors.text2,
                  }}>
                    {m.role === "ai" ? "AI" : "U"}
                  </div>
                  <div style={{
                    maxWidth: "82%", padding: "10px 14px", borderRadius: 12,
                    fontSize: 13, lineHeight: 1.65,
                    background: m.role === "ai" ? S.colors.bg3 : S.colors.accent,
                    color: m.role === "ai" ? S.colors.text : "#fff", whiteSpace: "pre-wrap",
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>AI</div>
                  <div style={{ padding: "10px 14px", borderRadius: 12, background: S.colors.bg3, display: "flex", gap: 4 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: S.colors.text3, animation: `bounce .6s infinite alternate ${i * 0.15}s`, display: "inline-block" }} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {isAnalyzable && (
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${S.colors.border}` }}>
            <div style={{ display: "flex", gap: 6, background: S.colors.bg, border: `1px solid ${S.colors.border}`, borderRadius: 10, padding: "4px 4px 4px 14px" }}>
              <input id="input-ai-chat" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !typing && send()}
                placeholder={t.viewer_placeholder}
                disabled={typing}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: S.colors.text, fontFamily: "inherit" }}
              />
              <button id="btn-ai-send" onClick={send} disabled={!input.trim() || typing}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: "none",
                  background: S.colors.accent, color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: input.trim() && !typing ? 1 : 0.3, transition: "opacity .15s",
                }}
              >
                <IconSend size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

