// ================================================================
//  环境变量集中校验 — 在应用启动时检查所有必填变量
//  在 Next.js instrumentation 钩子中调用，缺失时立即抛错
// ================================================================

const REQUIRED_SERVER_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "SPECKLE_TOKEN",
  "VPS_SECRET_TOKEN",
] as const;

export function validateEnv() {
  const missing = REQUIRED_SERVER_VARS.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `[启动失败] 缺少以下必要环境变量，请在 Netlify Dashboard 或 .env.local 中配置：\n` +
      missing.map((k) => `  ✗ ${k}`).join("\n")
    );
  }
}
