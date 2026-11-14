const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * 按类别为合规问题生成 AI 修复建议（分别请求各类别以提升相关性）
 * @param issues 问题列表
 * @param category 问题类别 (NAMING | UNICLASS | EIR)
 */
export async function generateFixSuggestionsByCategory(
  issues: Array<{
    elementId: string;
    elementType: string;
    message: string;
    field: string;
    currentValue?: string;
    expectedFormat?: string;
  }>,
  category: "NAMING" | "UNICLASS" | "EIR",
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();
  if (!GEMINI_API_KEY || issues.length === 0) return resultMap;

  // 按类别定制化的 prompt
  const categoryPrompts: Record<string, string> = {
    NAMING: `You are an ISO 19650 BIM Manager. Below are file naming violations against UK National Annex 7-field naming (Project-Originator-Volume-Level-Type-Role-Number).
For each issue, provide a concise (2-3 sentences) fix instruction for a Revit junior modeller, including the CORRECT compliant filename example.
Format: number, then actionable instruction with example.
Important: If current filename is provided, construct the corrected version following the pattern.
Do NOT repeat the issue description, ONLY provide the fix instruction and corrected example.`,

    UNICLASS: `You are an ISO 19650 BIM Manager specializing in Uniclass 2015 classification.
Below are element classification issues in IFC models.
For each issue, provide a concise (2-3 sentences) fix instruction for a Revit modeller to apply the correct Uniclass 2015 code.
Include the recommended classification code prefix (Pr_/Ss_/En_) and guidance for the element's IFC type.
Format: number, then actionable instruction.
Do NOT repeat the issue description, ONLY provide the fix instruction and correct code guidance.`,

    EIR: `You are an ISO 19650 BIM Manager responsible for EIR (Exchange Information Requirements) property completeness.
Below are missing or empty property issues in IFC models.
For each issue, provide a concise (2-3 sentences) instruction for a Revit modeller to populate the required property with realistic example values.
Include the PropertySet name and property name, and give a concrete example value if applicable.
Format: number, then actionable instruction with example.
Do NOT repeat the issue description, ONLY provide the fix instruction and example values.`,
  };

  // 构建该类别的问题上下文
  const issuesSummary = issues.slice(0, 15).map((issue, i) => {
    const parts = [
      `${i + 1}. [${issue.elementType}]`,
      `ID: ${issue.elementId}`,
      `Message: ${issue.message}`,
      `Field: ${issue.field}`,
    ];
    if (issue.currentValue) parts.push(`Current: ${issue.currentValue}`);
    if (issue.expectedFormat) parts.push(`Expected: ${issue.expectedFormat}`);
    return parts.join(" | ");
  }).join("\n");

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: categoryPrompts[category] }] },
          contents: [{ role: "user", parts: [{ text: issuesSummary }] }],
        }),
      },
    );

    if (!resp.ok) return resultMap;

    const result = await resp.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // 按编号分割，然后映射回原问题
    const suggestions = text.split(/\n(?=\d+\.)/).map((s: string) => s.trim()).filter(Boolean);
    suggestions.forEach((sugg: string, idx: number) => {
      if (issues[idx]) {
        resultMap.set(issues[idx].elementId || `${category}-${idx}`, sugg);
      }
    });
  } catch (err) {
    console.error(`AI suggestion generation failed for category ${category}:`, err);
  }

  return resultMap;
}

/**
 * @deprecated 改用 generateFixSuggestionsByCategory，按类别分别请求提升相关性
 */
export async function generateFixSuggestions(
  issues: Array<{
    elementId: string;
    elementType: string;
    message: string;
    field: string;
    currentValue?: string;
    expectedFormat?: string;
  }>,
): Promise<string[]> {
  if (!GEMINI_API_KEY || issues.length === 0) return [];
  // 此函数已废弃，新代码应使用 generateFixSuggestionsByCategory
  return [];
}
