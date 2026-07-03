// ================================================================
//  API Route: /api/fix-suggestions-by-category
//  按问题类别分别生成 AI 修复建议，提升相关性和准确性
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFixSuggestionsByCategory } from "@/app/api/compliance/route";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { category, issues } = await request.json();

    if (!category || !Array.isArray(issues) || issues.length === 0) {
      return NextResponse.json({ error: "category and issues array required" }, { status: 400 });
    }

    // 调用按类别的 AI 建议生成函数
    const suggestionsMap = await generateFixSuggestionsByCategory(issues, category);

    // 转换为对象格式
    const suggestions: Record<string, string> = {};
    suggestionsMap.forEach((suggestion, key) => {
      suggestions[key] = suggestion;
    });

    return NextResponse.json({
      status: "success",
      category,
      suggestions,
    });
  } catch (err) {
    console.error("Fix suggestions API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
