// ================================================================
//  Next.js Middleware — 拦截所有请求，刷新 Supabase Auth session
// ================================================================

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 排除静态资源、大文件上传接口和 Next.js 内部路由，防止突破 Edge Function 的 10MB 体积上限
    "/((?!api/upload|api/upload-to-speckle|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
