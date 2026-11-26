import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/dashboard" || path === "/viewer" || path === "/demo") {
    return NextResponse.redirect(new URL(path === "/dashboard" ? "/models" : "/workbench", request.url));
  }
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/workbench") return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!bim-viewer/|cloud-model-viewer/|api/library(?:/|$)|api/upload|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
