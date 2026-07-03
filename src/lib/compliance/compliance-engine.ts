// ================================================================
//  合规检查核心逻辑 — 硬规则引擎（前端侧预检）
//  NOTE: 这些是确定性规则，不依赖 AI。
//  AI 仅用于将检查结果"翻译"成人话修复建议。
// ================================================================

import namingRulesData from "./naming-rules.json";
import eirTemplatesData from "./eir-templates.json";
import uniclassData from "./uniclass-2015.json";

// ── 类型定义 ──────────────────────────────────────────────────

/** 合规错误严重级别 */
export type Severity = "ERROR" | "WARNING" | "INFO";

/** 合规检查规则类型 */
export type RuleCategory = "NAMING" | "UNICLASS" | "EIR";

/** 单条合规错误 */
export interface ComplianceIssue {
  id: string;
  category: RuleCategory;
  severity: Severity;
  /** 出错的构件/文件标识 */
  elementId: string;
  /** IFC 构件类型（如 IfcWall）或文件名 */
  elementType: string;
  /** 人类可读的错误描述 */
  message: string;
  /** 错误的具体字段或属性名 */
  field: string;
  /** 当前值（如有） */
  currentValue?: string;
  /** 期望值或格式 */
  expectedFormat?: string;
  /** AI 生成的修复建议（异步填充） */
  fixSuggestion?: string;
}

/** 合规检查整体结果 */
export interface ComplianceReport {
  /** 检查时间 */
  checkedAt: string;
  /** 项目/模型名称 */
  modelName: string;
  /** 总构件数 */
  totalElements: number;
  /** 合规率（0-100） */
  complianceScore: number;
  /** 各类别统计 */
  summary: {
    naming: { total: number; errors: number; warnings: number; passed: number };
    uniclass: { total: number; errors: number; warnings: number; passed: number };
    eir: { total: number; errors: number; warnings: number; passed: number };
  };
  /** 详细错误列表 */
  issues: ComplianceIssue[];
}

// ── 命名规范检查 ──────────────────────────────────────────────

/**
 * 检查文件名是否符合 BS EN ISO 19650-2 UK NA 七段命名规范
 * @param fileName 待检查的文件名（不含扩展名）
 * @returns 命名相关的合规问题列表
 */
export function checkNamingConvention(fileName: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const rules = namingRulesData.container_naming;
  const separator = rules.separator;
  const segments = fileName.split(separator);

  // 检查段数
  if (segments.length < 7) {
    issues.push({
      id: `naming-segments-${fileName}`,
      category: "NAMING",
      severity: "ERROR",
      elementId: fileName,
      elementType: "File",
      message: `命名必须包含 7 个字段（用 "${separator}" 分隔），当前只有 ${segments.length} 段`,
      field: "segment_count",
      currentValue: String(segments.length),
      expectedFormat: "Project-Originator-Volume-Level-Type-Role-Number",
    });
    return issues;
  }

  // 逐字段校验
  for (const field of rules.fields) {
    const value = segments[field.position - 1] || "";
    const regex = new RegExp(field.regex);

    if (!value) {
      issues.push({
        id: `naming-missing-${field.name}-${fileName}`,
        category: "NAMING",
        severity: "ERROR",
        elementId: fileName,
        elementType: "File",
        message: `第 ${field.position} 段 "${field.name}" 缺失`,
        field: field.name,
        expectedFormat: `${field.regex}（如 ${field.example}）`,
      });
    } else if (!regex.test(value)) {
      issues.push({
        id: `naming-format-${field.name}-${fileName}`,
        category: "NAMING",
        severity: "ERROR",
        elementId: fileName,
        elementType: "File",
        message: `第 ${field.position} 段 "${field.name}" 格式不正确：当前值 "${value}"`,
        field: field.name,
        currentValue: value,
        expectedFormat: `${field.regex}（如 ${field.example}）`,
      });
    }

    // 如果字段有 valid_values，额外校验值是否在白名单中
    if ("valid_values" in field && field.valid_values && regex.test(value)) {
      const validValues = field.valid_values as unknown as Record<string, string>;
      if (!(value in validValues)) {
        issues.push({
          id: `naming-value-${field.name}-${fileName}`,
          category: "NAMING",
          severity: "WARNING",
          elementId: fileName,
          elementType: "File",
          message: `第 ${field.position} 段 "${field.name}" 值 "${value}" 不在标准代码列表中`,
          field: field.name,
          currentValue: value,
          expectedFormat: `标准值: ${Object.keys(validValues).join(", ")}`,
        });
      }
    }
  }

  return issues;
}

/**
 * 检查状态码是否合法
 */
export function checkStatusCode(statusCode: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const validCodes = namingRulesData.status_codes.all_valid;

  if (!statusCode) {
    issues.push({
      id: "status-missing",
      category: "NAMING",
      severity: "ERROR",
      elementId: "status_code",
      elementType: "Metadata",
      message: "状态码（Status Code）缺失",
      field: "StatusCode",
      expectedFormat: `合法值: ${validCodes.join(", ")}`,
    });
  } else if (!validCodes.includes(statusCode)) {
    issues.push({
      id: `status-invalid-${statusCode}`,
      category: "NAMING",
      severity: "ERROR",
      elementId: "status_code",
      elementType: "Metadata",
      message: `状态码 "${statusCode}" 不合法`,
      field: "StatusCode",
      currentValue: statusCode,
      expectedFormat: `合法值: ${validCodes.join(", ")}`,
    });
  }

  return issues;
}

/**
 * 检查版本号格式
 */
export function checkRevision(revision: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const validRegex = new RegExp(namingRulesData.revision.valid_regex);

  if (!revision) {
    issues.push({
      id: "revision-missing",
      category: "NAMING",
      severity: "ERROR",
      elementId: "revision",
      elementType: "Metadata",
      message: "版本号（Revision）缺失",
      field: "Revision",
      expectedFormat: "P01 / P01.01 / C01 / C01.01",
    });
  } else if (!validRegex.test(revision)) {
    issues.push({
      id: `revision-invalid-${revision}`,
      category: "NAMING",
      severity: "ERROR",
      elementId: "revision",
      elementType: "Metadata",
      message: `版本号 "${revision}" 格式不正确`,
      field: "Revision",
      currentValue: revision,
      expectedFormat: "P01 / P01.01（施工前）或 C01 / C01.01（施工后）",
    });
  }

  return issues;
}

// ── Uniclass 2015 分类检查 ────────────────────────────────────

/**
 * 根据 IFC 实体类型推荐 Uniclass 2015 表格区段
 * 宁可宽泛也不许张冠李戴
 */
function getUniclassGuidanceForIfcType(ifcType: string): string {
  const guidance: Record<string, string> = {
    // 结构构件 → Ss_20_30 Structural frame
    "IfcBeam": "Refer to Uniclass Ss_20_30 (Structural frames)",
    "IfcColumn": "Refer to Uniclass Ss_20_30 (Structural frames)",
    "IfcMember": "Refer to Uniclass Ss_20_30 (Structural frames)",
    "IfcPlate": "Refer to Uniclass Ss_20_30 (Structural frames)",
    "IfcBrace": "Refer to Uniclass Ss_20_30 (Structural frames)",

    // 地基桩 → Ss_20 Substructure
    "IfcPile": "Refer to Uniclass Ss_20 (Substructure)",
    "IfcFooting": "Refer to Uniclass Ss_20 (Substructure)",

    // 墙体 → Ss_30 Exterior walls 或 Ss_35 Interior walls
    "IfcWall": "Refer to Uniclass Ss_30-35 (Walls) or Ss_40 (Roof)",
    "IfcWallStandardCase": "Refer to Uniclass Ss_30-35 (Walls)",

    // 门窗 → Pr_25 (Doors & windows)
    "IfcDoor": "Refer to Uniclass Pr_25 (Doors)",
    "IfcWindow": "Refer to Uniclass Pr_25 (Windows)",

    // 楼板/覆盖物 → Ss_40 Roof
    "IfcSlab": "Refer to Uniclass Ss_40 (Roof) or Ss_50 (Internal elements)",
    "IfcRoof": "Refer to Uniclass Ss_40 (Roof)",

    // 栏杆/栏杆扶手 → Ss_51 Balustrades
    "IfcRailing": "Refer to Uniclass Ss_51 (Balustrades)",

    // 楼梯 → Ss_45 Stairs
    "IfcStair": "Refer to Uniclass Ss_45 (Stairs)",
    "IfcStairFlight": "Refer to Uniclass Ss_45 (Stairs)",

    // 家具 → Pr_40 (Furniture)
    "IfcFurniture": "Refer to Uniclass Pr_40 (Furniture)",

    // 不确定的类型
    "IfcBuildingElementProxy": "Refer to Uniclass Ss or Pr tables based on element function",
    "IfcGenericObject": "Refer to Uniclass Ss or Pr tables based on element function",
  };

  return guidance[ifcType] || "Refer to Uniclass Ss/Pr tables based on IFC entity type and function";
}

/**
 * 检查构件的 Uniclass 分类码是否有效
 * @param elementId 构件 ID
 * @param elementType IFC 类名
 * @param classificationCode 构件的 Classification 值
 */
export function checkUniclass(
  elementId: string,
  elementType: string,
  classificationCode: string | null | undefined,
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const expectedGuidance = getUniclassGuidanceForIfcType(elementType);

  if (!classificationCode) {
    issues.push({
      id: `uniclass-missing-${elementId}`,
      category: "UNICLASS",
      severity: "ERROR",
      elementId,
      elementType,
      message: `Element missing Uniclass 2015 classification code`,
      field: "Classification",
      expectedFormat: expectedGuidance,
    });
    return issues;
  }

  // 检查前缀格式
  const prefixRegex = new RegExp(uniclassData.lookup_prefix_rules.valid_top_level_regex);
  if (!prefixRegex.test(classificationCode)) {
    issues.push({
      id: `uniclass-format-${elementId}`,
      category: "UNICLASS",
      severity: "ERROR",
      elementId,
      elementType,
      message: `Classification code "${classificationCode}" format invalid`,
      field: "Classification",
      currentValue: classificationCode,
      expectedFormat: "Must start with Pr_/Ss_/En_ prefix followed by numeric codes",
    });
    return issues;
  }

  // 检查是否在已知字典中
  const allCodes = {
    ...uniclassData.products,
    ...uniclassData.systems,
  } as Record<string, string>;

  if (!(classificationCode in allCodes)) {
    // 只是警告，因为字典是精简版
    issues.push({
      id: `uniclass-unknown-${elementId}`,
      category: "UNICLASS",
      severity: "WARNING",
      elementId,
      elementType,
      message: `Classification code "${classificationCode}" not found in condensed dictionary`,
      field: "Classification",
      currentValue: classificationCode,
      expectedFormat: expectedGuidance,
    });
  }

  return issues;
}

// ── EIR 属性完整性检查 ────────────────────────────────────────

interface ElementProperties {
  /** 构件的所有 PropertySet → Property 映射 */
  [psetName: string]: {
    [propertyName: string]: string | number | boolean | null;
  };
}

/**
 * 检查构件的 EIR 必填属性是否完整
 * @param elementId 构件 ID
 * @param ifcClass IFC 类名（如 IfcWall）
 * @param properties 构件的属性集
 * @param templateId 使用的 EIR 模板 ID
 */
export function checkEirProperties(
  elementId: string,
  ifcClass: string,
  properties: ElementProperties,
  templateId: string = "default",
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const template = eirTemplatesData.templates[templateId as keyof typeof eirTemplatesData.templates];

  if (!template) return issues;

  // 查找该 IFC 类的 EIR 规则
  const classRule = template.rules.find(
    (r: { ifc_class: string }) => r.ifc_class === ifcClass,
  );
  if (!classRule) return issues;

  for (const req of classRule.required_properties) {
    const pset = properties[req.pset];
    const value = pset?.[req.property];

    if (value === undefined || value === null) {
      issues.push({
        id: `eir-missing-${elementId}-${req.property}`,
        category: "EIR",
        severity: "ERROR",
        elementId,
        elementType: ifcClass,
        message: `缺少必填属性 ${req.pset}.${req.property}（${req.description}）`,
        field: `${req.pset}.${req.property}`,
        expectedFormat: req.description,
      });
    } else if (value === "" || value === 0) {
      issues.push({
        id: `eir-empty-${elementId}-${req.property}`,
        category: "EIR",
        severity: "WARNING",
        elementId,
        elementType: ifcClass,
        message: `属性 ${req.property}（${req.description}）值为空`,
        field: `${req.pset}.${req.property}`,
        currentValue: String(value),
        expectedFormat: req.description,
      });
    }
  }

  return issues;
}

// ── 评分等级映射 ──────────────────────────────────────────────

export type ComplianceGrade = "Excellent" | "Good" | "Needs Improvement" | "Non-compliant";

/**
 * 根据分数返回合规等级
 * 90+: Excellent | 70+: Good | 50+: Needs Improvement | <50: Non-compliant
 */
export function getComplianceGrade(score: number): ComplianceGrade {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Non-compliant";
}

/**
 * 统一的评分计算函数（扣分制）
 * score = max(0, 100 - errors×10 - warnings×1)
 * 此函数是唯一的评分来源，Dashboard、审计面板、PDF 都必须引用本函数
 * @param totalErrors 错误数量
 * @param totalWarnings 警告数量
 */
export function calculateComplianceScore(totalErrors: number, totalWarnings: number): number {
  return Math.max(0, 100 - totalErrors * 10 - totalWarnings * 1);
}

// ── 聚合统计 ──────────────────────────────────────────────────

/**
 * 将所有错误聚合成合规报告摘要
 */
export function aggregateReport(
  modelName: string,
  totalElements: number,
  issues: ComplianceIssue[],
): ComplianceReport {
  const categorize = (cat: RuleCategory) => {
    const catIssues = issues.filter((i) => i.category === cat);
    return {
      total: catIssues.length,
      errors: catIssues.filter((i) => i.severity === "ERROR").length,
      warnings: catIssues.filter((i) => i.severity === "WARNING").length,
      passed: 0,
    };
  };

  const naming = categorize("NAMING");
  const uniclass = categorize("UNICLASS");
  const eir = categorize("EIR");

  const totalErrors = naming.errors + uniclass.errors + eir.errors;
  const totalWarnings = naming.warnings + uniclass.warnings + eir.warnings;

  // 使用统一的评分函数
  const complianceScore = calculateComplianceScore(totalErrors, totalWarnings);

  return {
    checkedAt: new Date().toISOString(),
    modelName,
    totalElements,
    complianceScore,
    summary: { naming, uniclass, eir },
    issues,
  };
}
