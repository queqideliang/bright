// ================================================================
//  API Route: /api/lemon/checkout — 生成 Lemon Squeezy 结算链接
//  POST { plan: "pro" | "project" } → { checkoutUrl }
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 从 URL 中提取的 Variant UUID（对应 Lemon Squeezy Dashboard 中的产品）
const LEMON_VARIANTS: Record<string, string> = {
  pro:     "40255b8d-f644-47ba-8c01-46b5c1c78484", // $99/month Pro
  project: "d25e703c-0d6b-4817-a9c1-8a901fd85426", // $499/project One-time
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { plan } = await request.json();
    const variantId = LEMON_VARIANTS[plan as keyof typeof LEMON_VARIANTS];

    if (!variantId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // 直接构建 Lemon Squeezy 结算 URL（带邮箱预填）
    // 格式：https://store.lemonsqueezy.com/checkout/buy/{variantId}?checkout[email]=...
    const email = user.email ?? "";
    const checkoutUrl = `https://brightsun.lemonsqueezy.com/checkout/buy/${variantId}` +
      (email ? `?checkout[email]=${encodeURIComponent(email)}&checkout[custom][user_id]=${encodeURIComponent(user.id)}` : "");

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("Lemon checkout error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
