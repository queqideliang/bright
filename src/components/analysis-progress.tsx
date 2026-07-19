// ================================================================
//  AI 分析进度显示组件 — 实时日志 + Tips 轮播
// ================================================================

"use client";

import { useState, useEffect } from "react";
import { S } from "@/lib/constants";

interface AnalysisStep {
  id: string;
  label: string;
  status: "pending" | "processing" | "done" | "error";
  startTime?: number;
  endTime?: number;
}

interface Props {
  progress: number;
  steps?: AnalysisStep[];
  lang?: "zh" | "en";
}

// ISO 19650 相关的实用 Tips
const TIPS_ZH = [
  "💡 ISO 19650-2 要求 BIM 数据必须采用 7 段式命名方式，以便在 CDE（中央数据环境）中正确识别",
  "💡 Uniclass 2015 是英国国家标准分类系统，用于确保构件分类的一致性和可互操作性",
  "💡 EIR（信息需求）是 CDE 能否接收你的模型的关键，缺失属性会导致 CDE 拒绝上传",
  "💡 Status Code（S0-S7）用于追踪设计和交付阶段，S0 是草稿，S7 是存档归档",
  "💡 版本号应该从 01 开始递增，这样便于团队跟踪模型的修订历史",
  "💡 防火等级和荷载等级是结构工程师的关键参数，必须完整填写以满足 BS 1192-4",
  "💡 定期审查 BIM 合规性可以在上传前及早发现问题，避免被 CDE 拒绝",
  "💡 AI 修复建议是根据实时数据生成的，可以直接在 Revit 中按步骤操作"
];

const TIPS_EN = [
  "💡 ISO 19650-2 requires BIM data to use 7-segment naming for proper CDE identification",
  "💡 Uniclass 2015 is the UK national classification standard ensuring consistency and interoperability",
  "💡 EIR (Element Information Requirements) is critical for CDE acceptance — missing attributes cause upload rejection",
  "💡 Status Codes (S0-S7) track design and delivery phases — S0 is draft, S7 is archived",
  "💡 Version numbers should start at 01 and increment, making it easy to track model revisions",
  "💡 Fire rating and load rating are crucial structural parameters that must be complete per BS 1192-4",
  "💡 Regular BIM compliance reviews catch issues before upload, preventing CDE rejections",
  "💡 AI fix suggestions are generated in real-time and can be applied step-by-step in Revit"
];

const DEFAULT_STEPS: AnalysisStep[] = [
  { id: "parsing", label: "解析 IFC 构件数据", status: "pending" },
  { id: "naming", label: "检查命名规范（7段式）", status: "pending" },
  { id: "uniclass", label: "验证 Uniclass 分类", status: "pending" },
  { id: "eir", label: "检查 EIR 属性完整性", status: "pending" },
  { id: "ai", label: "生成 AI 修复建议", status: "pending" },
  { id: "report", label: "生成合规报告", status: "pending" },
];

const DEFAULT_STEPS_EN: AnalysisStep[] = [
  { id: "parsing", label: "Parsing IFC element data", status: "pending" },
  { id: "naming", label: "Checking naming standards (7-segment)", status: "pending" },
  { id: "uniclass", label: "Validating Uniclass classification", status: "pending" },
  { id: "eir", label: "Checking EIR attribute completeness", status: "pending" },
  { id: "ai", label: "Generating AI fix suggestions", status: "pending" },
  { id: "report", label: "Generating compliance report", status: "pending" },
];

function getProgressBasedSteps(progress: number, lang: "zh" | "en"): AnalysisStep[] {
  const steps = lang === "zh" ? DEFAULT_STEPS : DEFAULT_STEPS_EN;
  const progressToStep: Record<number, number> = {
    0: 0,    // 刚开始
    15: 1,   // 正在解析
    25: 2,   // 解析完成，开始检查命名
    45: 3,   // 检查分类
    60: 4,   // 检查属性
    75: 5,   // 生成AI建议
    90: 5,   // 生成报告
    100: 6,  // 完成
  };

  let activeStepIndex = 0;
  for (const [p, idx] of Object.entries(progressToStep)) {
    if (progress >= parseInt(p)) {
      activeStepIndex = idx;
    }
  }

  return steps.map((step, idx) => {
    if (idx < activeStepIndex) {
      return { ...step, status: "done" };
    } else if (idx === activeStepIndex) {
      return { ...step, status: "processing" };
    } else {
      return { ...step, status: "pending" };
    }
  });
}

export function AnalysisProgress({ progress, steps, lang = "zh" }: Props) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [displaySteps, setDisplaySteps] = useState<AnalysisStep[]>(
    lang === "zh" ? DEFAULT_STEPS : DEFAULT_STEPS_EN
  );

  const tips = lang === "zh" ? TIPS_ZH : TIPS_EN;

  // 根据进度自动更新步骤状态
  useEffect(() => {
    const autoSteps = getProgressBasedSteps(progress, lang);
    setDisplaySteps(steps || autoSteps);
  }, [progress, steps, lang]);

  // 每 8 秒轮换一个 Tip
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [tips.length]);

  // 计算剩余时间估计
  const getETA = () => {
    if (progress <= 0 || progress >= 100) return null;
    const remaining = 100 - progress;
    const avgSpeed = progress / Math.max(1, progress); // 简单的速度估计
    const etaSeconds = (remaining / (avgSpeed || 1)) * 10;
    if (etaSeconds > 1800) return null; // 超过30分钟则不显示
    return etaSeconds >= 60
      ? `约 ${Math.ceil(etaSeconds / 60)} 分钟`
      : `约 ${Math.ceil(etaSeconds)} 秒`;
  };

  const eta = getETA();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        color: S.colors.text3,
        padding: 40,
      }}
    >
      {/* 主标题 + 动画图标 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 48, animation: "spin 3s linear infinite" }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: S.colors.text }}>
          {lang === "zh" ? "AI 正在深度解析模型" : "AI is analyzing your model"}
        </div>
        <div style={{ fontSize: 13, color: S.colors.text3 }}>
          {lang === "zh"
            ? "这个过程通常需要 3-5 分钟，请不要关闭此页面"
            : "This usually takes 3-5 minutes, please keep this page open"}
        </div>
      </div>

      {/* 进度条 */}
      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <div style={{ width: "100%", height: 10, borderRadius: 5, background: S.colors.bg3, overflow: "hidden" }}>
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              borderRadius: 5,
              background: `linear-gradient(90deg, ${S.colors.accent}, ${S.colors.orange})`,
              transition: "width 1s ease",
              boxShadow: `0 0 20px ${S.colors.accent}40`,
            }}
          />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: S.colors.accent }}>{progress}%</div>
        {eta && (
          <div style={{ fontSize: 12, color: S.colors.text3 }}>
            {lang === "zh" ? "预计剩余" : "ETA"}: {eta}
          </div>
        )}
      </div>

      {/* 处理步骤清单 */}
      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.colors.text, marginBottom: 8 }}>
          {lang === "zh" ? "处理步骤" : "Processing Steps"}
        </div>
        {displaySteps.map((step) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              background:
                step.status === "done"
                  ? S.colors.greenBg
                  : step.status === "processing"
                    ? S.colors.accentLight
                    : S.colors.bg3,
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                fontSize: 16,
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {step.status === "done" && "✅"}
              {step.status === "processing" && <span style={{ animation: "pulse 1.2s infinite" }}>⏳</span>}
              {step.status === "pending" && "⭕"}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color:
                  step.status === "done"
                    ? S.colors.green
                    : step.status === "processing"
                      ? S.colors.accent
                      : S.colors.text3,
              }}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tips 轮播 */}
      <div
        style={{
          width: 340,
          padding: "14px 16px",
          borderRadius: 12,
          background: S.colors.accentLight,
          borderLeft: `4px solid ${S.colors.accent}`,
          minHeight: 60,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: S.colors.accent,
            lineHeight: 1.6,
            animation: "fadeInOut 0.5s ease-in-out",
          }}
        >
          {tips[currentTipIndex]}
        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
