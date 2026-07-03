// ================================================================
//  数据驱动 PDF 合规报告生成器
//  jsPDF + jspdf-autotable — 不依赖 DOM 截图，无 WebGL 白屏问题
// ================================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getStandardsByCategory, formatStandardReference } from "./compliance-standards";
import { getComplianceGrade } from "./compliance/compliance-engine";

// ── 类型定义（与 fix-it-list.tsx 保持一致）──────────────────────

export interface ComplianceIssue {
  id: string;
  category: "NAMING" | "UNICLASS" | "EIR";
  severity: "ERROR" | "WARNING" | "INFO";
  elementId: string;
  elementType: string;
  message: string;
  field: string;
  currentValue?: string;
  expectedFormat?: string;
}

export interface ComplianceReport {
  checkedAt: string;
  modelName: string;
  totalElements: number;
  complianceScore: number;
  summary: {
    naming:   { total: number; errors: number; warnings: number; passed: number };
    uniclass: { total: number; errors: number; warnings: number; passed: number };
    eir:      { total: number; errors: number; warnings: number; passed: number };
  };
  issues: ComplianceIssue[];
}

export interface PDFExportOptions {
  report: ComplianceReport;
  projectName: string;
  fixSuggestions: Record<string, string>;
  snapshotDataUrl?: string | null;
  language?: "zh" | "en";
}

// ── 品牌色 ────────────────────────────────────────────────────────
const COLOR = {
  accent:  [99,  102, 241] as [number, number, number],
  red:     [239,  68,  68] as [number, number, number],
  orange:  [249, 115,  22] as [number, number, number],
  green:   [ 34, 197,  94] as [number, number, number],
  text:    [ 15,  23,  42] as [number, number, number],
  text3:   [100, 116, 139] as [number, number, number],
  bg:      [248, 250, 252] as [number, number, number],
  border:  [226, 232, 240] as [number, number, number],
  white:   [255, 255, 255] as [number, number, number],
};

const CATEGORY_LABEL: Record<string, string> = {
  NAMING:   "Naming Convention",
  UNICLASS: "Uniclass 2015",
  EIR:      "EIR Properties",
};

// ── 3D 快照捕获（同源 canvas 优先，否则返回 null）──────────────

export async function captureViewerSnapshot(iframeEl: HTMLIFrameElement | null): Promise<string | null> {
  if (!iframeEl) return null;
  try {
    // Speckle embed 是跨域 iframe，只在同源部署时能访问
    const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
    if (!iframeDoc) return null;
    const glCanvas = iframeDoc.querySelector("canvas") as HTMLCanvasElement | null;
    if (!glCanvas) return null;
    // WebGL canvas 需要 preserveDrawingBuffer=true 才能 toDataURL
    return glCanvas.toDataURL("image/jpeg", 0.85);
  } catch {
    // 跨域或 WebGL tainted — 静默失败，PDF 封面留空
    return null;
  }
}

// ── 主导出函数 ────────────────────────────────────────────────────

export async function exportCompliancePDF(opts: PDFExportOptions): Promise<boolean> {
  const { report, projectName, fixSuggestions, snapshotDataUrl } = opts;

  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = pdf.internal.pageSize.getWidth();   // 210
    const H = pdf.internal.pageSize.getHeight();  // 297

    // 注册支持 CJK 的字体（仅用于用户数据，如项目名和构件名）
    // 注：这里假设已在项目中包含 NotoSansSC-Regular.ttf
    // 生产环境应将字体文件部署到 public/fonts/ 并正确配置 jsPDF

    // ── 封面 ──────────────────────────────────────────────────────
    _drawCover(pdf, W, H, report, projectName, snapshotDataUrl ?? null);

    // ── 第 2 页：摘要 + 分类汇总表 + 规范说明 ─────────────────────
    pdf.addPage();
    let y = _drawPageHeader(pdf, W, "Compliance Summary", 2);
    y = _drawSummaryCards(pdf, W, y, report);
    y = _drawSummaryTable(pdf, W, y, report);

    // ── 规范参考页 ───────────────────────────────────────────────
    pdf.addPage();
    y = _drawPageHeader(pdf, W, "Applicable Standards", pdf.getNumberOfPages());
    _drawStandardsReference(pdf, W, y, report);

    // ── 按类别逐表输出问题（含规范引用）──────────────────────────
    const categories: Array<"NAMING" | "UNICLASS" | "EIR"> = ["NAMING", "UNICLASS", "EIR"];
    for (const cat of categories) {
      const catIssues = report.issues.filter((i) => i.category === cat);
      if (catIssues.length === 0) continue;

      pdf.addPage();
      const catLabel = CATEGORY_LABEL[cat];
      y = _drawPageHeader(pdf, W, catLabel || "", pdf.getNumberOfPages());
      y = _drawIssuesTable(pdf, W, y, catIssues, fixSuggestions, cat);
    }

    // AI Fix Suggestions
    const issuesWithFix = report.issues.filter((i) => fixSuggestions[i.id]);
    if (issuesWithFix.length > 0) {
      pdf.addPage();
      y = _drawPageHeader(pdf, W, "AI Fix Suggestions", pdf.getNumberOfPages());
      _drawFixSuggestions(pdf, W, y, issuesWithFix, fixSuggestions);
    }

    // Warning aggregation (for large datasets)
    const warnings = report.issues.filter((i) => i.severity === "WARNING");
    if (warnings.length > 10) {
      pdf.addPage();
      y = _drawPageHeader(pdf, W, "Issues by Element Type (Aggregated)", pdf.getNumberOfPages());
      _drawWarningAggregation(pdf, W, y, warnings);
    }

    // Detailed issue appendix
    if (report.issues.length > 0) {
      pdf.addPage();
      y = _drawPageHeader(pdf, W, "Detailed Issue Appendix", pdf.getNumberOfPages());
      _drawIssueAppendix(pdf, W, y, report.issues);
    }

    // Page numbers
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      _drawFooter(pdf, W, H, p, totalPages);
    }

    const safeName = projectName.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`${safeName}_ISO19650_Report_${dateStr}.pdf`);
    return true;
  } catch (err) {
    console.error("PDF export failed:", err);
    return false;
  }
}

// ── 封面绘制 ──────────────────────────────────────────────────────

function _drawCover(
  pdf: jsPDF, W: number, H: number,
  report: ComplianceReport, projectName: string,
  snapshot: string | null,
) {
  // 顶部紫色色块
  pdf.setFillColor(...COLOR.accent);
  pdf.rect(0, 0, W, 52, "F");

  // 品牌名
  pdf.setTextColor(...COLOR.white);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("BrightSun BIM", 14, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("ISO 19650 Compliance Platform", 14, 25);

  // 生成日期（右上）
  pdf.setFontSize(8);
  pdf.text(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }), W - 14, 18, { align: "right" });

  // 主标题
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("BIM Compliance Audit Report", 14, 46);

  // 3D 快照或占位区
  const snapY = 58;
  const snapH = 72;
  if (snapshot) {
    pdf.addImage(snapshot, "JPEG", 14, snapY, W - 28, snapH);
  } else {
    pdf.setFillColor(...COLOR.bg);
    pdf.roundedRect(14, snapY, W - 28, snapH, 4, 4, "F");
    pdf.setTextColor(...COLOR.text3);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "italic");
    pdf.text("3D model view — open the platform to interact", W / 2, snapY + snapH / 2, { align: "center" });
  }

  // 项目信息块
  const infoY = snapY + snapH + 10;
  pdf.setFillColor(...COLOR.bg);
  pdf.roundedRect(14, infoY, W - 28, 32, 4, 4, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLOR.text3);
  pdf.text("PROJECT", 20, infoY + 8);
  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR.text);
  pdf.text(_truncate(projectName, 45), 20, infoY + 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLOR.text3);
  pdf.text("MODEL", 20, infoY + 24);
  pdf.setFontSize(9);
  pdf.setTextColor(...COLOR.text);
  pdf.text(_truncate(report.modelName, 55), 20, infoY + 30);

  // 合规分数大卡
  const scoreY = infoY + 42;
  const scoreColor = report.complianceScore >= 80 ? COLOR.green
    : report.complianceScore >= 50 ? COLOR.orange : COLOR.red;

  pdf.setFillColor(...scoreColor);
  pdf.roundedRect(14, scoreY, (W - 28) / 2 - 4, 42, 6, 6, "F");

  pdf.setTextColor(...COLOR.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(32);
  pdf.text(`${report.complianceScore}%`, 14 + (W - 28) / 4, scoreY + 24, { align: "center" });
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("COMPLIANCE SCORE", 14 + (W - 28) / 4, scoreY + 34, { align: "center" });

  // 等级标签
  const grade = getComplianceGrade(report.complianceScore);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  const gradeColor = report.complianceScore >= 90 ? COLOR.green
    : report.complianceScore >= 70 ? COLOR.blue
    : report.complianceScore >= 50 ? COLOR.orange : COLOR.red;
  pdf.setTextColor(...gradeColor);
  pdf.text(`(${grade})`, 14 + (W - 28) / 4, scoreY + 39, { align: "center" });

  // 总元素数卡
  pdf.setFillColor(...COLOR.border);
  pdf.roundedRect(14 + (W - 28) / 2 + 4, scoreY, (W - 28) / 2 - 4, 42, 6, 6, "F");
  pdf.setTextColor(...COLOR.text);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.text(`${report.totalElements}`, 14 + (W - 28) * 3 / 4 + 4, scoreY + 24, { align: "center" });
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLOR.text3);
  pdf.text("TOTAL ELEMENTS", 14 + (W - 28) * 3 / 4 + 4, scoreY + 34, { align: "center" });
}

// ── 页眉 ──────────────────────────────────────────────────────────

function _drawPageHeader(pdf: jsPDF, W: number, title: string, _page: number): number {
  pdf.setFillColor(...COLOR.accent);
  pdf.rect(0, 0, W, 14, "F");
  pdf.setTextColor(...COLOR.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("BrightSun BIM · ISO 19650 Compliance Report", 14, 9.5);
  pdf.setFont("helvetica", "normal");
  pdf.text(new Date().toLocaleDateString("en-GB"), W - 14, 9.5, { align: "right" });

  pdf.setTextColor(...COLOR.text);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, 14, 28);
  pdf.setFillColor(...COLOR.accent);
  pdf.rect(14, 30, 24, 1, "F");

  return 38;
}

// ── 摘要数字卡 ────────────────────────────────────────────────────

function _drawSummaryCards(pdf: jsPDF, W: number, y: number, report: ComplianceReport): number {
  const totalErrors   = report.summary.naming.errors + report.summary.uniclass.errors + report.summary.eir.errors;
  const totalWarnings = report.summary.naming.warnings + report.summary.uniclass.warnings + report.summary.eir.warnings;

  const cards = [
    { label: "Errors",   value: String(totalErrors),   color: COLOR.red },
    { label: "Warnings", value: String(totalWarnings), color: COLOR.orange },
    { label: "Compliance Score", value: `${report.complianceScore}%`,
      color: report.complianceScore >= 80 ? COLOR.green : report.complianceScore >= 50 ? COLOR.orange : COLOR.red },
  ];

  const cardW = (W - 28 - 8) / 3;
  cards.forEach((card, i) => {
    const x = 14 + i * (cardW + 4);
    pdf.setFillColor(...COLOR.bg);
    pdf.roundedRect(x, y, cardW, 22, 3, 3, "F");
    pdf.setFillColor(...card.color);
    pdf.rect(x, y, 3, 22, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(...card.color);
    pdf.text(card.value, x + cardW / 2, y + 12, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...COLOR.text3);
    pdf.text(card.label, x + cardW / 2, y + 19, { align: "center" });
  });

  return y + 30;
}

// ── 汇总表 ────────────────────────────────────────────────────────

function _drawSummaryTable(pdf: jsPDF, W: number, y: number, report: ComplianceReport): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLOR.text);
  pdf.text("Check Category Summary", 14, y);
  y += 5;

  const headers = ["Category", "Errors", "Warnings", "Passed", "Total"];
  const catLabels = ["Naming Convention", "Uniclass 2015 Classification", "EIR Property Completeness"];

  autoTable(pdf, {
    startY: y,
    head: [headers],
    body: [
      [catLabels[0], report.summary.naming.errors, report.summary.naming.warnings, report.summary.naming.passed, report.summary.naming.total],
      [catLabels[1], report.summary.uniclass.errors, report.summary.uniclass.warnings, report.summary.uniclass.passed, report.summary.uniclass.total],
      [catLabels[2], report.summary.eir.errors, report.summary.eir.warnings, report.summary.eir.passed, report.summary.eir.total],
    ],
    theme: "grid",
    headStyles: { fillColor: COLOR.accent, textColor: COLOR.white, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: COLOR.text },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { halign: "center", textColor: COLOR.red },
      2: { halign: "center", textColor: COLOR.orange },
      3: { halign: "center", textColor: COLOR.green },
      4: { halign: "center" },
    },
    alternateRowStyles: { fillColor: COLOR.bg },
    margin: { left: 14, right: 14 },
  });

  return (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

// ── 规范参考页 ────────────────────────────────────────────────────

function _drawStandardsReference(
  pdf: jsPDF, W: number, y: number,
  report: ComplianceReport,
): number {
  const categories: Array<"NAMING" | "UNICLASS" | "EIR"> = ["NAMING", "UNICLASS", "EIR"];

  for (const cat of categories) {
    if (y > 250) {
      pdf.addPage();
      y = _drawPageHeader(pdf, W, "Applicable Standards (Cont'd)", pdf.getNumberOfPages());
    }

    const standards = getStandardsByCategory(cat, "en");
    if (standards.length === 0) continue;

    // 类别标题
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...COLOR.accent);
    const catTitle = { NAMING: "1. Naming Standards", UNICLASS: "2. Uniclass Standards", EIR: "3. EIR Standards" }[cat];
    pdf.text(catTitle, 14, y);
    y += 6;

    for (const std of standards) {
      // 标准名称和引用
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...COLOR.text);
      pdf.text(std.name.en, 14, y);
      y += 4;

      // 引用
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR.text3);
      pdf.text(`Reference: ${std.reference.en}`, 14, y);
      y += 4;

      // 描述（自动换行）
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR.text);
      const desc = std.description.en;
      const splitDesc = pdf.splitTextToSize(desc, W - 28);
      pdf.text(splitDesc, 14, y);
      y += splitDesc.length * 3.5 + 3;

      // 相关条款
      if (std.relatedClauses.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR.text3);
        pdf.text("Related clauses:", 14, y);
        y += 3;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        const clauseText = std.relatedClauses.join(" | ");
        const splitClauses = pdf.splitTextToSize(clauseText, W - 28);
        pdf.text(splitClauses, 14, y);
        y += splitClauses.length * 2.5 + 4;
      }
    }

    y += 4;
  }

  return y;
}

// ── 问题明细表 ────────────────────────────────────────────────────

function _drawIssuesTable(
  pdf: jsPDF, W: number, y: number,
  issues: ComplianceIssue[], fixSuggestions: Record<string, string>,
  category: "NAMING" | "UNICLASS" | "EIR",
): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLOR.text);
  pdf.text(`Issues Found (${issues.length})`, 14, y);

  // 显示该类别适用的规范
  const standards = getStandardsByCategory(category, "en");
  if (standards.length > 0) {
    y += 4;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...COLOR.text3);
    const stdNames = standards.map(s => s.name.en).join(" | ");
    const stdText = `Applicable standards: ${stdNames}`;
    const splitStd = pdf.splitTextToSize(stdText, W - 28);
    pdf.text(splitStd, 14, y);
    y += splitStd.length * 2.5 + 1;
  }

  y += 2;

  const headers = ["Severity", "Type", "Field", "Issue", "Current", "Expected"];

  const rows = issues.map((issue) => [
    issue.severity,
    _truncate(issue.elementType, 18),
    _truncate(issue.field, 22),
    _truncate(issue.message, 50),
    _truncate(issue.currentValue ?? "—", 22),
    _truncate(issue.expectedFormat ?? "—", 28),
  ]);

  autoTable(pdf, {
    startY: y,
    head: [headers],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: COLOR.text, textColor: COLOR.white, fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 6.5, textColor: COLOR.text, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 16, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 26 },
      3: { cellWidth: 52 },
      4: { cellWidth: 28 },
      5: { cellWidth: 32 },
    },
    didParseCell(data) {
      if (data.column.index === 0 && data.section === "body") {
        const val = String(data.cell.raw);
        data.cell.styles.textColor = val === "ERROR" ? COLOR.red : val === "WARNING" ? COLOR.orange : COLOR.text3;
        data.cell.styles.fontStyle = "bold";
      }
    },
    alternateRowStyles: { fillColor: [250, 250, 255] as [number, number, number] },
    margin: { left: 14, right: 14 },
    rowPageBreak: "avoid",
  });

  // 如果该类别有 fix suggestions，在表格下显示为段落区块（避免截断）
  const withFix = issues.filter((i) => fixSuggestions[i.id]);
  if (withFix.length > 0) {
    const afterY = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLOR.accent);
    const fixTitle = "AI Fix Suggestions for this Category";
    pdf.text(fixTitle, 14, afterY);

    let currentY = afterY + 6;
    const maxWidth = W - 28; // 页面宽度减去两侧边距

    withFix.forEach((issue, idx) => {
      // 检查是否需要新页面
      if (currentY > 270) {
        pdf.addPage();
        currentY = _drawPageHeader(pdf, W, "", pdf.getNumberOfPages(), language) + 4;
      }

      // 编号和问题
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR.text);
      const issueLabel = `${idx + 1}. ${issue.message}`;
      const splitIssue = pdf.splitTextToSize(issueLabel, maxWidth - 4);
      pdf.text(splitIssue, 18, currentY);
      currentY += splitIssue.length * 3 + 2;

      // 修复建议（完整显示，无截断）
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR.text2);
      const suggestion = fixSuggestions[issue.id];
      const splitSuggestion = pdf.splitTextToSize(suggestion, maxWidth - 8);
      pdf.text(splitSuggestion, 22, currentY);
      currentY += splitSuggestion.length * 3 + 4;
    });

    return currentY;
  }

  return (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

// ── AI 建议汇总页 ─────────────────────────────────────────────────

function _drawFixSuggestions(
  pdf: jsPDF, W: number, y: number,
  issues: ComplianceIssue[], fixSuggestions: Record<string, string>,
) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLOR.text3);
  pdf.text("The following AI-generated fix steps are tailored for Revit modellers.", 14, y);
  y += 8;

  const catLabels = { NAMING: "Naming", UNICLASS: "Uniclass", EIR: "EIR" };

  const headers = ["#", "Severity", "Category", "Issue (field)", "AI Fix Suggestion"];

  autoTable(pdf, {
    startY: y,
    head: [headers],
    body: issues.map((issue, idx) => [
      idx + 1,
      issue.severity,
      catLabels[issue.category] ?? issue.category,
      `${_truncate(issue.message, 42)}\n[${issue.field}]`,
      _truncate(fixSuggestions[issue.id], 90),
    ]),
    theme: "grid",
    headStyles: { fillColor: COLOR.accent, textColor: COLOR.white, fontStyle: "bold", fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: COLOR.text, minCellHeight: 10 },
    columnStyles: {
      0: { cellWidth: 8,  halign: "center" },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 32 },
      3: { cellWidth: 52 },
      4: { cellWidth: W - 28 - 8 - 16 - 32 - 52 },
    },
    didParseCell(data) {
      if (data.column.index === 1 && data.section === "body") {
        const val = String(data.cell.raw);
        data.cell.styles.textColor = val === "ERROR" ? COLOR.red : val === "WARNING" ? COLOR.orange : COLOR.text3;
        data.cell.styles.fontStyle = "bold";
      }
    },
    alternateRowStyles: { fillColor: [248, 246, 255] as [number, number, number] },
    margin: { left: 14, right: 14 },
    rowPageBreak: "avoid",
  });
}

// ── 页脚 ──────────────────────────────────────────────────────────

function _drawFooter(pdf: jsPDF, W: number, H: number, page: number, total: number) {
  pdf.setFillColor(...COLOR.border);
  pdf.rect(0, H - 10, W, 10, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...COLOR.text3);
  pdf.text("BrightSun BIM · ISO 19650 Compliance Platform · brightsunliang.top", 14, H - 3.5);
  pdf.text(`Page ${page} of ${total}`, W - 14, H - 3.5, { align: "right" });
}

// ── Warning 聚合展示（按构件类型分组）──────────────────────────

function _drawWarningAggregation(
  pdf: jsPDF, W: number, y: number,
  warnings: ComplianceIssue[],
): number {
  // 按 elementType 分组
  const grouped = new Map<string, number>();
  warnings.forEach((w) => {
    grouped.set(w.elementType, (grouped.get(w.elementType) || 0) + 1);
  });

  // 按数量降序排列
  const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLOR.text);

  sorted.forEach(([type, count]) => {
    if (y > 260) {
      pdf.addPage();
      y = _drawPageHeader(pdf, W, "Issues by Element Type (Aggregated - Cont'd)", pdf.getNumberOfPages());
    }

    const text = `${type} ×${count}`;
    pdf.text(text, 20, y);
    y += 6;
  });

  return y + 4;
}

// ── 详细问题附录（全部问题含构件名和GUID）──────────────────────

function _drawIssueAppendix(
  pdf: jsPDF, W: number, y: number,
  issues: ComplianceIssue[],
): number {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...COLOR.text3);
  pdf.text("(This appendix provides complete traceability with element IDs and types for each issue)", 14, y);
  y += 6;

  const rows = issues.map((issue) => [
    _truncate(issue.elementId, 20),  // Element ID / GUID
    _truncate(issue.elementType, 16), // IFC Type
    _truncate(issue.category, 12),    // Category
    _truncate(issue.severity, 10),    // Severity
    _truncate(issue.message, 50),     // Message
  ]);

  autoTable(pdf, {
    startY: y,
    head: [["Element ID / GUID", "Element Type", "Category", "Severity", "Issue"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: COLOR.text, textColor: COLOR.white, fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: COLOR.text, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 22 },
      2: { cellWidth: 18 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 104 },
    },
    didParseCell(data) {
      if (data.column.index === 3 && data.section === "body") {
        const val = String(data.cell.raw);
        data.cell.styles.textColor = val === "ERROR" ? COLOR.red : val === "WARNING" ? COLOR.orange : COLOR.text3;
        data.cell.styles.fontStyle = "bold";
      }
    },
    alternateRowStyles: { fillColor: [250, 250, 255] as [number, number, number] },
    margin: { left: 14, right: 14 },
    rowPageBreak: "avoid",
  });

  return (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

// ── 工具函数 ──────────────────────────────────────────────────────

function _truncate(str: string, max: number): string {
  if (!str) return "";
  // 去掉无法在 jsPDF 标准字体中渲染的 CJK 字符
  const safe = str.replace(/[^\x00-\x7F]/g, (c) => {
    const map: Record<string, string> = { "：": ":", "，": ",", "。": ".", "（": "(", "）": ")" };
    return map[c] ?? "";
  });
  return safe.length > max ? safe.slice(0, max - 1) + "…" : safe;
}

// ── 旧接口保留，供 viewer/page.tsx 渐进迁移 ─────────────────────

/** @deprecated 改用 exportCompliancePDF */
export async function exportToPDF(_elementId: string, _filename: string): Promise<boolean> {
  console.warn("exportToPDF is deprecated. Use exportCompliancePDF instead.");
  return false;
}
