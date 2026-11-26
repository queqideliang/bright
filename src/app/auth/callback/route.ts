// ================================================================
//  OAuth 回调 Route Handler
//  Google 登录完成后，Supabase 会重定向到此路由
//  负责将 code 交换为 session
// ================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginDestination } from "@/lib/login-destination";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = loginDestination(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 认证失败 → 回到登录页
  const retry = new URL('/login', origin);
  retry.searchParams.set('error', 'auth_failed');
  retry.searchParams.set('next', next);
  return NextResponse.redirect(retry);
}
