// ================================================================
//  BIM 合规标准库 — ISO 19650、UK BIM Framework、Uniclass 2015
// ================================================================

export interface ComplianceStandard {
  id: string;
  name: {
    zh: string;
    en: string;
  };
  reference: {
    zh: string;
    en: string;
  };
  description: {
    zh: string;
    en: string;
  };
  relatedClauses: string[];
}

export const STANDARDS: Record<string, ComplianceStandard> = {
  // ── 命名规范 ──────────────────────────────────────────────────────
  "naming-uk-na": {
    id: "naming-uk-na",
    name: {
      zh: "英国命名标准(UK NA)",
      en: "UK Naming Architecture (NA)",
    },
    reference: {
      zh: "ISO 19650-1:2018 & UK BIM Framework PAS 1192-2",
      en: "ISO 19650-1:2018 & UK BIM Framework PAS 1192-2",
    },
    description: {
      zh: "7段式命名规范：项目-发起者-分卷-层级-类型-角色-编号。用于标准化BIM文件和对象的命名，确保信息的可追溯性和一致性。",
      en: "7-field naming standard: Project-Originator-Volume-Level-Type-Role-Number. Standardizes naming of BIM files and objects for traceability and consistency across the project lifecycle.",
    },
    relatedClauses: [
      "ISO 19650-1:2018 Clause 5.4",
      "PAS 1192-2:2013 Clause 6.3",
      "UK BIM Framework - Document Naming Convention",
    ],
  },

  "naming-status-code": {
    id: "naming-status-code",
    name: {
      zh: "状态码标准",
      en: "Status Code Convention",
    },
    reference: {
      zh: "ISO 19650-1:2018 & PAS 1192-2",
      en: "ISO 19650-1:2018 & PAS 1192-2",
    },
    description: {
      zh: "文档状态码(S0-S7)标准。S0-草稿，S1-供协调，S2-供评审，S3-供批准，S4-发布供建造，S5-如建造，S6-如现状，S7-存档。",
      en: "Document status codes S0-S7. S0-draft, S1-for coordination, S2-for review, S3-for approval, S4-released for construction, S5-as-built, S6-as-exists, S7-archived.",
    },
    relatedClauses: [
      "ISO 19650-1:2018 Clause 5.4.3",
      "PAS 1192-2:2013 Clause 6.3.3",
    ],
  },

  "naming-revision": {
    id: "naming-revision",
    name: {
      zh: "版本号标准",
      en: "Revision Number Convention",
    },
    reference: {
      zh: "ISO 19650 & UK BIM Framework",
      en: "ISO 19650 & UK BIM Framework",
    },
    description: {
      zh: "版本号递进标准。从01开始，每次重大修改递增。确保所有参与方使用最新版本。",
      en: "Revision numbering progression starting from 01. Increment for each significant change. Ensures all parties use the latest version.",
    },
    relatedClauses: [
      "ISO 19650-1:2018 Clause 5.4.3",
      "UK BIM Framework - Version Control",
    ],
  },

  // ── Uniclass 分类 ─────────────────────────────────────────────────
  "uniclass-2015": {
    id: "uniclass-2015",
    name: {
      zh: "Uniclass 2015 分类标准",
      en: "Uniclass 2015 Classification Standard",
    },
    reference: {
      zh: "ISO 12006-2:2015 & NBS Uniclass 2015",
      en: "ISO 12006-2:2015 & NBS Uniclass 2015",
    },
    description: {
      zh: "英国国家建筑规范(NBS)维护的分类系统。每个建筑构件必须分配正确的Uniclass代码，确保信息的语义一致性和可交互性。",
      en: "Classification system maintained by the National Building Specification (NBS) in the UK. Every building element must have a valid Uniclass code for semantic consistency and interoperability.",
    },
    relatedClauses: [
      "ISO 12006-2:2015 (Building Information Models - Information Management)",
      "NBS Uniclass 2015 - Table of entities",
    ],
  },

  // ── EIR 属性 ───────────────────────────────────────────────────────
  "eir-properties": {
    id: "eir-properties",
    name: {
      zh: "EIR(信息需求)属性标准",
      en: "EIR (Exchange Information Requirements) Properties",
    },
    reference: {
      zh: "ISO 19650-1:2018 Clause 4.3",
      en: "ISO 19650-1:2018 Clause 4.3",
    },
    description: {
      zh: "规定项目各阶段所需的结构化信息属性。包括防火等级、荷载等级、材料信息等关键参数。这些属性确保BIM模型包含足够的信息以支持项目决策和建造执行。",
      en: "Specifies structured information properties required at each project stage. Includes fire rating, load class, material properties, and other critical parameters needed for project decisions and construction execution.",
    },
    relatedClauses: [
      "ISO 19650-1:2018 Clause 4.3 (Information Requirements)",
      "BS 1192-4:2014 (Collaborative production of architecture, engineering and construction information)",
    ],
  },

  // ── CDE(公共数据环境) ──────────────────────────────────────────────
  "cde-readiness": {
    id: "cde-readiness",
    name: {
      zh: "CDE 上传前审核",
      en: "CDE (Common Data Environment) Readiness Check",
    },
    reference: {
      zh: "ISO 19650:2018 & PAS 1192-2:2013",
      en: "ISO 19650:2018 & PAS 1192-2:2013",
    },
    description: {
      zh: "确保数据在上传至共享数据环境前符合所有合规要求。这是模型提交前的最后检查点。",
      en: "Ensures all data meets compliance requirements before uploading to the Common Data Environment. This is the final gate before model submission.",
    },
    relatedClauses: [
      "ISO 19650-1:2018 Clause 5.2 & 5.3",
      "PAS 1192-2:2013 Clause 6 & 7",
    ],
  },
};

// ── 问题类别 → 规范映射 ────────────────────────────────────────────
export const CATEGORY_TO_STANDARDS: Record<string, string[]> = {
  NAMING: [
    "naming-uk-na",
    "naming-status-code",
    "naming-revision",
  ],
  UNICLASS: [
    "uniclass-2015",
  ],
  EIR: [
    "eir-properties",
  ],
};

// ── 获取规范详情 ──────────────────────────────────────────────────────
export function getStandard(id: string, lang: "zh" | "en" = "en"): ComplianceStandard | null {
  const std = STANDARDS[id];
  return std ? std : null;
}

export function getStandardsByCategory(
  category: "NAMING" | "UNICLASS" | "EIR",
  lang: "zh" | "en" = "en",
): ComplianceStandard[] {
  const ids = CATEGORY_TO_STANDARDS[category] || [];
  return ids.map(id => STANDARDS[id]).filter(Boolean);
}

// ── 格式化规范引用 ────────────────────────────────────────────────────
export function formatStandardReference(
  standardId: string,
  lang: "zh" | "en" = "en",
): string {
  const std = STANDARDS[standardId];
  if (!std) return "";
  return `${std.name[lang]} (${std.reference[lang]})`;
}
