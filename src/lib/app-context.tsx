// ================================================================
//  全局应用状态 Context — 集成 Supabase Auth
//  NOTE: 监听 onAuthStateChange 自动同步登录状态
// ================================================================

"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { T, DEMO_PROJECTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Lang, Project, Translations, User } from "@/lib/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface AppState {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  selectedProject: Project;
  setSelectedProject: (p: Project) => void;
  showUpload: boolean;
  setShowUpload: (v: boolean) => void;
  /** 上传完成后调用，触发 Dashboard 重新拉取项目列表 */
  dashboardRefreshKey: number;
  refreshDashboard: () => void;
}

const AppContext = createContext<AppState | null>(null);

/**
 * 将 Supabase Auth User 转换为应用内的 User 类型
 */
function mapUser(su: SupabaseUser | null): User | null {
  if (!su) return null;
  return {
    name: su.user_metadata?.full_name ?? su.user_metadata?.name ?? su.email?.split("@")[0] ?? "User",
    email: su.email ?? "",
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project>(DEMO_PROJECTS[0]);
  const [showUpload, setShowUpload] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const refreshDashboard = useCallback(() => setDashboardRefreshKey((k) => k + 1), []);

  const supabase = createClient();

  // NOTE: 初始化时获取当前 session，并监听 auth 状态变更
  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSupabaseUser(user);
      setLoading(false);
    };
    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLang = useCallback(() => {
    setLang((l) => (l === "zh" ? "en" : "zh"));
  }, []);

  /** 邮箱 + 密码登录 */
  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Google OAuth 登录 */
  const loginWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 邮箱注册 */
  const signup = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 退出登录 */
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSupabaseUser(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppContext.Provider
      value={{
        lang,
        t: T[lang],
        toggleLang,
        user: mapUser(supabaseUser),
        supabaseUser,
        loading,
        login,
        loginWithGoogle,
        signup,
        logout,
        selectedProject,
        setSelectedProject,
        showUpload,
        setShowUpload,
        dashboardRefreshKey,
        refreshDashboard,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/** 在任何客户端组件中获取全局 App 状态 */
export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
