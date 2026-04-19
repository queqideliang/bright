// ================================================================
//  服务端 Supabase 客户端
//  用于 Server Components、Route Handlers、Server Actions
// ================================================================

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // NOTE: 在 Server Component 中调用 set 会抛出异常，
            // 但 middleware 会负责刷新 session，可以安全忽略
          }
        },
      },
    }
  );
}

/** Service Role 客户端 — 仅用于服务端，拥有完整 Storage 权限 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
