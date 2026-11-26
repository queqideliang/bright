import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { archiveId } from "./lib/archive-report.ts";
import { libraryIdPattern } from "./lib/model-library/formats.ts";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/viewer") {
    const query = request.nextUrl.searchParams;
    const ids = [...new Set([...query.getAll("modelId"), ...query.getAll("id")])];
    const external = [...query.keys()].some(key => /^(?:stream(?:id)?|speckle\w*)$/i.test(key));
    const model = ids[0];
    if (!external && ids.length === 1 && model && archiveId.test(model)) {
      const libraryId = model.toLowerCase();
      if (libraryIdPattern.test(libraryId)) return NextResponse.redirect(new URL("/models/" + libraryId, request.url));
      const target = new URL("/reports", request.url);
      target.searchParams.set("model", model);
      return NextResponse.redirect(target);
    }
  }
  if (path === "/dashboard" || path === "/viewer" || path === "/demo") {
    return NextResponse.redirect(new URL(path === "/dashboard" ? "/models" : "/workbench", request.url));
  }
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/workbench") return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!bim-viewer/|cloud-model-viewer/|review-report/|api/library(?:/|$)|api/upload|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
