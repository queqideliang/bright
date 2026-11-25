import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/workbench") return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!bim-viewer/|cloud-model-viewer/|api/library(?:/|$)|api/upload|api/upload-to-speckle|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
