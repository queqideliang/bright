// ================================================================
//  登录页 — 接入 Supabase Auth (邮箱密码 + Google OAuth)
// ================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { IconGoogle } from "@/components/icons";
import { S } from "@/lib/constants";

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: S.colors.text2, marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: `1px solid ${S.colors.border}`, fontSize: 14,
  outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: S.colors.bg,
};
const btnGhost: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 8, border: `1px solid ${S.colors.border}`,
  background: "transparent", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};

export default function LoginPage() {
  const { t, login, loginWithGoogle, signup, toggleLang } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isSignup) {
        const result = await signup(email, password, name);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(t.lang === "EN" ? "注册成功！请检查邮箱确认链接。" : "Registration successful! Please check your email for confirmation.");
        }
      } else {
        const result = await login(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          router.push("/dashboard");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    await loginWithGoogle();
  };

  return (
    <div
      style={{
        minHeight: "100vh", background: S.colors.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
      }}
    >
      <div
        style={{
          width: 400, padding: 40, background: "#fff",
          borderRadius: 20, boxShadow: "0 8px 30px rgba(0,0,0,.08)",
          border: `1px solid ${S.colors.border}`,
        }}
      >
        {/* 品牌头部 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 18, color: "#fff", marginBottom: 16,
            }}
          >
            B
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: S.colors.text }}>
            {isSignup ? t.signup : t.login}
          </h1>
          <p style={{ fontSize: 14, color: S.colors.text3, margin: 0 }}>{t.tagSub}</p>
        </div>

        {/* 错误 / 成功提示 */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: S.colors.redBg, color: S.colors.red, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: S.colors.greenBg, color: S.colors.green, fontSize: 13, marginBottom: 16 }}>
            {success}
          </div>
        )}

        {/* 表单 */}
        <form id="form-login" onSubmit={handleSubmit}>
          {isSignup && (
            <>
              <label style={labelStyle}>{t.lang === "EN" ? "姓名" : "Name"}</label>
              <input
                id="input-name"
                style={inputStyle}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.lang === "EN" ? "请输入姓名" : "Enter your name"}
                required
              />
              <div style={{ height: 14 }} />
            </>
          )}
          <label style={labelStyle}>{t.email}</label>
          <input
            id="input-email"
            style={inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="me@brightsunliang.top"
            required
          />
          <label style={{ ...labelStyle, marginTop: 14 }}>{t.password}</label>
          <input
            id="input-password"
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "12px 0", marginTop: 20,
              borderRadius: 10, border: "none",
              background: loading ? S.colors.text3 : "#6366f1", color: "#fff",
              fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >
            {loading ? "..." : isSignup ? t.signup : t.login}
          </button>
        </form>

        {/* 切换登录/注册 */}
        <div style={{ textAlign: "center", margin: "16px 0", fontSize: 13, color: S.colors.text3 }}>
          {isSignup
            ? <>{t.lang === "EN" ? "已有账号？" : "Already have an account?"} <button onClick={() => { setIsSignup(false); setError(null); }} style={{ background: "none", border: "none", color: S.colors.accent, cursor: "pointer", fontSize: 13 }}>{t.login}</button></>
            : <>{t.lang === "EN" ? "没有账号？" : "No account?"} <button onClick={() => { setIsSignup(true); setError(null); }} style={{ background: "none", border: "none", color: S.colors.accent, cursor: "pointer", fontSize: 13 }}>{t.signup}</button></>
          }
        </div>

        {/* 第三方登录 */}
        <div style={{ textAlign: "center", margin: "8px 0 16px", color: S.colors.text3, fontSize: 13 }}>
          {t.loginWith}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            id="btn-login-google"
            onClick={handleGoogleLogin}
            style={{
              ...btnGhost, flex: 1, padding: "10px 0", borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, fontSize: 13, color: S.colors.text2,
            }}
          >
            <IconGoogle /> Google
          </button>
        </div>

        {/* 返回首页 */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            id="btn-back-home"
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: S.colors.accent, fontSize: 13, cursor: "pointer" }}
          >
            ← {t.lang === "EN" ? "返回首页" : "Back to home"}
          </button>
        </div>
      </div>

      <button
        id="btn-lang-login"
        onClick={toggleLang}
        style={{ position: "fixed", top: 20, right: 20, ...btnGhost, color: S.colors.text2, fontSize: 12 }}
      >
        {t.lang}
      </button>
    </div>
  );
}
