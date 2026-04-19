// ================================================================
//  浏览器端 Supabase 客户端
//  NOTE: 仅在 "use client" 组件中使用
// ================================================================

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
