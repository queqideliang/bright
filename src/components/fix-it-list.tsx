// ================================================================
//  Fix-it List 组件 — ISO 19650 合规检查结果展示面板
//  替代原有的 AI 聊天面板，展示结构化的合规错误与修复建议
// ================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { S } from "@/lib/constants";
import type { Project } from "@/lib/types";

// ── 类型定义 ──────────────────────────────────────────────────

interface ComplianceIssue {
  id: string;
  category: "NAMING" | "UNICLASS" | "EIR";
  severity: "ERROR" | "WARNING" | "INFO";
  elementId: string;
  elementType: string;
  message: string;
  field: string;
  currentValue?: string;
  expectedFormat?: string;
  fixSuggestion?: string;
}

interface ComplianceSummary {
  naming: { total: number; errors: number; warnings: number; passed: number };
  uniclass: { total: number; errors: number; warnings: number; passed: number };
  eir: { total: number; errors: number; warnings: number; passed: number };
}

interface ComplianceReport {
  checkedAt: string;
  modelName: string;
  totalElements: number;
  complianceScore: number;
  summary: ComplianceSummary;
  issues: ComplianceIssue[];
}

interface FixItListProps {
  selectedProject: Project;
  onExportPdf?: (report: ComplianceReport, fixSuggestions: Record<string, string>) => void;
  isExporting?: boolean;
}

type CheckStatus = "idle" | "checking" | "completed" | "error";
type FilterCategory = "ALL" | "NAMING" | "UNICLASS" | "EIR";

// ── 样式常量 ──────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  ERROR: { bg: S.colors.redBg, color: S.colors.red, label: "Error" },
  WARNING: { bg: S.colors.orangeBg, color: S.colors.orange, label: "Warning" },
  INFO: { bg: S.colors.blueBg, color: S.colors.blue, label: "Info" },
};

const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  NAMING: { icon: "📋", label: "Naming" },
  UNICLASS: { icon: "🏷️", label: "Uniclass" },
  EIR: { icon: "📝", label: "EIR" },
};

// ── 组件 ──────────────────────────────────────────────────────

export function FixItList({ selectedProject, onExportPdf, isExporting }: FixItListProps) {
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [filter, setFilter] = useState<FilterCategory>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fixSuggestions, setFixSuggestions] = useState<Record<string, string>>({});
  const [loadingFixes, setLoadingFixes] = useState(false);

  // 触发合规检查
  const runCheck = useCallback(async () => {
    setStatus("checking");
    try {
      const resp = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: String(selectedProject.id),
          projectId: String(selectedProject.id),
          fileName: selectedProject.name,
        }),
      });

      if (!resp.ok) throw new Error(`API error: ${resp.status}`);

      const data = await resp.json();
      if (data.status === "completed" && data.report) {
        setReport(data.report);
        setStatus("completed");
      } else {
        setStatus("idle");
      }
    } catch (err) {
      console.error("Compliance check error:", err);
      setStatus("error");
    }
  }, [selectedProject.id, selectedProject.name]);

  // 页面加载时尝试获取已有结果
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const resp = await fetch(`/api/compliance?modelId=${encodeURIComponent(String(selectedProject.id))}`);
        const data = await resp.json();
        if (data.status === "completed" && data.report) {
          setReport(data.report);
          setStatus("completed");
        }
      } catch {
        // 静默处理
      }
    };
    fetchExisting();
  }, [selectedProject.id]);

  // 为当前可见的错误批量生成 AI 修复建议
  const generateFixes = useCallback(async () => {
    if (!report || report.issues.length === 0) return;
    setLoadingFixes(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Please generate fix-it suggestions for these ISO 19650 compliance issues:\n${report.issues.slice(0, 15).map((issue, i) => `${i + 1}. [${issue.elementType}] ${issue.message} (field: ${issue.field}${issue.currentValue ? `, current: ${issue.currentValue}` : ""})`).join("\n")}\n\nFor each issue, give a 2-3 sentence actionable fix instruction for a Revit modeller. Number your responses to match.`,
          projectId: String(selectedProject.id),
          modelId: String(selectedProject.id),
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const answer = data.answer || "";
        // 按编号解析
        const lines = answer.split(/\n(?=\d+\.)/).filter(Boolean);
        const newFixes: Record<string, string> = {};
        lines.forEach((line: string, i: number) => {
          if (report.issues[i]) {
            newFixes[report.issues[i].id] = line.replace(/^\d+\.\s*/, "").trim();
          }
        });
        setFixSuggestions((prev) => ({ ...prev, ...newFixes }));
      }
    } catch (err) {
      console.error("Fix suggestion error:", err);
    } finally {
      setLoadingFixes(false);
    }
  }, [report, selectedProject.id]);

  // 过滤后的问题列表
  const filteredIssues = report?.issues.filter(
    (i) => filter === "ALL" || i.category === filter,
  ) || [];

  const totalErrors = report ? report.summary.naming.errors + report.summary.uniclass.errors + report.summary.eir.errors : 0;
  const totalWarnings = report ? report.summary.naming.warnings + report.summary.uniclass.warnings + report.summary.eir.warnings : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── 顶部标题栏 ── */}
      <div style={{
        padding: "14px 18px",
        borderBottom: `1px solid ${S.colors.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: status === "completed" ? S.colors.green :
              status === "checking" ? S.colors.orange : S.colors.text3,
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: S.colors.text }}>
            ISO 19650 Compliance
          </span>
        </div>
        <span style={{ fontSize: 11, color: S.colors.text3 }}>
          {status === "completed" ? `Score: ${report?.complianceScore}%` : "Rule Engine"}
        </span>
      </div>

      {/* ── 主内容区域 ── */}
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {status === "idle" && (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: S.colors.text, marginBottom: 8 }}>
              ISO 19650 Compliance Check
            </div>
            <div style={{ fontSize: 12, color: S.colors.text3, lineHeight: 1.7, marginBottom: 20, maxWidth: 260, margin: "0 auto 20px" }}>
              Run a compliance check against UK BIM Framework naming conventions, Uniclass 2015, and EIR requirements.
            </div>
            <button
              id="btn-run-compliance"
              onClick={runCheck}
              style={{
                padding: "12px 28px", borderRadius: 10, border: "none",
                background: S.colors.accent, color: "#fff", fontSize: 14,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              🔍 Run Compliance Check
            </button>
          </div>
        )}

        {status === "checking" && (
          <div style={{ textAlign: "center", padding: "60px 16px" }}>
            <div style={{ fontSize: 40, marginBottom: 12, animation: "spin 2s linear infinite" }}>⚙️</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: S.colors.text }}>
              Running compliance checks...
            </div>
            <div style={{ fontSize: 12, color: S.colors.text3, marginTop: 8 }}>
              Checking naming, Uniclass, and EIR rules
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: S.colors.red, marginBottom: 12 }}>
              Check failed. Model data may not be ready.
            </div>
            <button onClick={runCheck}
              style={{
                padding: "10px 24px", borderRadius: 8, border: `1px solid ${S.colors.accent}`,
                background: "transparent", color: S.colors.accent, fontSize: 13,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {status === "completed" && report && (
          <>
            {/* 合规评分概览 */}
            <div style={{
              padding: 16, borderRadius: 12,
              background: report.complianceScore >= 80 ? S.colors.greenBg :
                report.complianceScore >= 50 ? S.colors.orangeBg : S.colors.redBg,
              border: `1px solid ${report.complianceScore >= 80 ? S.colors.green :
                report.complianceScore >= 50 ? S.colors.orange : S.colors.red}`,
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 36, fontWeight: 800,
                color: report.complianceScore >= 80 ? S.colors.green :
                  report.complianceScore >= 50 ? S.colors.orange : S.colors.red,
              }}>
                {report.complianceScore}%
              </div>
              <div style={{ fontSize: 12, color: S.colors.text2, marginTop: 4 }}>
                Compliance Score · {totalErrors} errors · {totalWarnings} warnings
              </div>
            </div>

            {/* 分类统计卡片 */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["NAMING", "UNICLASS", "EIR"] as const).map((cat) => {
                const stats = report.summary[cat.toLowerCase() as keyof ComplianceSummary];
                const catInfo = CATEGORY_LABELS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(filter === cat ? "ALL" : cat)}
                    style={{
                      flex: 1, padding: "10px 6px", borderRadius: 8,
                      border: filter === cat ? `2px solid ${S.colors.accent}` : `1px solid ${S.colors.border}`,
                      background: filter === cat ? S.colors.accentLight : "#fff",
                      cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 14 }}>{catInfo.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: S.colors.text2, marginTop: 2 }}>
                      {catInfo.label}
                    </div>
                    <div style={{ fontSize: 11, color: stats.errors > 0 ? S.colors.red : S.colors.green, fontWeight: 700, marginTop: 2 }}>
                      {stats.errors > 0 ? `${stats.errors} err` : "✓ Pass"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* AI 修复建议生成按钮 */}
            {Object.keys(fixSuggestions).length === 0 && report.issues.length > 0 && (
              <button
                id="btn-generate-fixes"
                onClick={generateFixes}
                disabled={loadingFixes}
                style={{
                  padding: "10px 16px", borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff", fontSize: 12, fontWeight: 700,
                  cursor: loadingFixes ? "wait" : "pointer", fontFamily: "inherit",
                  opacity: loadingFixes ? 0.6 : 1,
                }}
              >
                {loadingFixes ? "⏳ Generating fix suggestions..." : "🔧 Generate AI Fix Suggestions"}
              </button>
            )}

            {/* 问题列表 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredIssues.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: 24, color: S.colors.green,
                  fontSize: 14, fontWeight: 600,
                }}>
                  ✅ All {filter === "ALL" ? "" : CATEGORY_LABELS[filter]?.label + " "}checks passed!
                </div>
              ) : (
                filteredIssues.map((issue) => {
                  const severity = SEVERITY_STYLES[issue.severity];
                  const catInfo = CATEGORY_LABELS[issue.category];
                  const isExpanded = expandedId === issue.id;
                  const fix = fixSuggestions[issue.id];

                  return (
                    <div
                      key={issue.id}
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                      style={{
                        padding: "10px 12px", borderRadius: 10,
                        border: `1px solid ${severity.color}20`,
                        background: severity.bg,
                        cursor: "pointer",
                        transition: "all .15s",
                      }}
                    >
                      {/* 问题头部 */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{catInfo.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{
                              padding: "2px 6px", borderRadius: 4,
                              fontSize: 9, fontWeight: 800,
                              background: severity.color, color: "#fff",
                            }}>
                              {severity.label}
                            </span>
                            <span style={{ fontSize: 10, color: S.colors.text3 }}>
                              {issue.elementType} · {issue.elementId.slice(0, 12)}{issue.elementId.length > 12 ? "…" : ""}
                            </span>
                          </div>
                          <div style={{
                            fontSize: 12, color: S.colors.text, lineHeight: 1.5,
                            fontWeight: 600,
                          }}>
                            {issue.message}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: S.colors.text3, flexShrink: 0 }}>
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>

                      {/* 展开详情 */}
                      {isExpanded && (
                        <div style={{
                          marginTop: 10, paddingTop: 10,
                          borderTop: `1px solid ${severity.color}20`,
                          fontSize: 11, lineHeight: 1.6,
                        }}>
                          {issue.currentValue && (
                            <div style={{ color: S.colors.text2, marginBottom: 4 }}>
                              <strong>Current:</strong> <code style={{ background: "#fff", padding: "1px 4px", borderRadius: 3 }}>{issue.currentValue}</code>
                            </div>
                          )}
                          {issue.expectedFormat && (
                            <div style={{ color: S.colors.text2, marginBottom: 4 }}>
                              <strong>Expected:</strong> {issue.expectedFormat}
                            </div>
                          )}
                          {fix && (
                            <div style={{
                              marginTop: 8, padding: "8px 10px", borderRadius: 8,
                              background: "#fff", border: `1px solid ${S.colors.accent}30`,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: S.colors.accent, marginBottom: 4 }}>
                                🔧 How to fix:
                              </div>
                              <div style={{ fontSize: 11, color: S.colors.text, whiteSpace: "pre-wrap" }}>
                                {fix}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 底部操作栏 ── */}
      {status === "completed" && report && (
        <div style={{
          padding: "10px 14px", borderTop: `1px solid ${S.colors.border}`,
          display: "flex", gap: 8,
        }}>
          <button
            id="btn-recheck"
            onClick={runCheck}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8,
              border: `1px solid ${S.colors.border}`,
              background: "transparent", color: S.colors.text2,
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            🔄 Re-check
          </button>
          {!!onExportPdf && (
            <button
              id="btn-export-compliance-pdf"
              onClick={() => report && onExportPdf?.(report, fixSuggestions)}
              disabled={isExporting}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                background: S.colors.accent, color: "#fff",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                opacity: isExporting ? 0.6 : 1,
              }}
            >
              {isExporting ? "⏳ Exporting..." : "📄 Export PDF Report"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
