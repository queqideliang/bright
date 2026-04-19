// ================================================================
//  Next.js Instrumentation Hook — 服务启动时运行，早于任何请求
//  文档: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// ================================================================

export async function register() {
  // 仅在服务端运行（排除 Edge Runtime）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
