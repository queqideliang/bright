// ================================================================
//  登录页 — 接入 Supabase Auth (邮箱密码 + Google OAuth)
//  NOTE: 注册流程使用 6 位数字 OTP 验证码验证
// ================================================================

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { IconGoogle } from "@/components/icons";
import { S } from "@/lib/constants";

/** 重发验证码倒计时（秒） */
const RESEND_COOLDOWN = 60;
/** OTP 验证码位数 */
const OTP_LENGTH = 6;

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

/**
 * 6 位 OTP 验证码输入组件
 * 每位数字独立输入框，自动焦点跳转，支持退格删除回退
 */
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * 处理单格输入 — 输入一位后自动跳转到下一格
   * NOTE: 只允许数字输入，非数字字符会被忽略
   */
  const handleChange = useCallback(
    (index: number, inputValue: string) => {
      // 处理粘贴的多位数字
      if (inputValue.length > 1) {
        const digits = inputValue.replace(/\D/g, "").slice(0, OTP_LENGTH);
        const next = [...value];
        for (let i = 0; i < digits.length && index + i < OTP_LENGTH; i++) {
          next[index + i] = digits[i];
        }
        onChange(next);
        const focusIdx = Math.min(index + digits.length, OTP_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();
        return;
      }

      if (inputValue && !/^\d$/.test(inputValue)) return;

      const next = [...value];
      next[index] = inputValue;
      onChange(next);

      // 输入一位后自动跳转到下一格
      if (inputValue && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [value, onChange],
  );

  /**
   * 处理退格键 — 清空当前格后自动回退到前一格
   */
  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [value],
  );

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          id={`otp-input-${i}`}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          style={{
            width: 48,
            height: 56,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            borderRadius: 12,
            border: `2px solid ${value[i] ? S.colors.accent : S.colors.border}`,
            outline: "none",
            fontFamily: "'Inter', monospace",
            background: S.colors.bg,
            transition: "all 0.2s ease",
            color: S.colors.text,
            caretColor: S.colors.accent,
          }}
          onMouseEnter={(e) => {
            if (!disabled) (e.target as HTMLInputElement).style.borderColor = S.colors.accent2;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLInputElement).style.borderColor = value[i] ? S.colors.accent : S.colors.border;
          }}
        />
      ))}
    </div>
  );
}

/**
 * 重发验证码倒计时 Hook
 * 管理 60 秒冷却倒计时状态
 */
function useResendCountdown() {
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { countdown, startCountdown, canResend: countdown === 0 };
}

export default function LoginPage() {
  const { t, login, loginWithGoogle, signup, verifyOTP, toggleLang } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // OTP 验证码相关状态
  const [showOtpView, setShowOtpView] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const { countdown, startCountdown, canResend } = useResendCountdown();

  /**
   * 提交注册/登录表单
   * 注册成功后自动切换到 OTP 验证码输入界面
   */
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
          // 注册成功 → 切换到 OTP 验证码输入界面
          setShowOtpView(true);
          setOtpValues(Array(OTP_LENGTH).fill(""));
          startCountdown();
          setSuccess(
            t.lang === "EN"
              ? "验证码已发送到您的邮箱，请查收。"
              : "A verification code has been sent to your email."
          );
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

  /**
   * 验证 OTP 验证码
   * 成功后直接跳转到 /dashboard
   */
  const handleVerify = async () => {
    const token = otpValues.join("");
    if (token.length !== OTP_LENGTH) {
      setError(t.lang === "EN" ? "请输入完整的 6 位验证码" : "Please enter the full 6-digit code");
      return;
    }

    setError(null);
    setVerifying(true);

    try {
      const result = await verifyOTP(email, token);
      if (result.error) {
        setError(t.lang === "EN" ? "验证码无效或已过期" : "Invalid or expired verification code");
        setOtpValues(Array(OTP_LENGTH).fill(""));
      } else {
        router.push("/dashboard");
      }
    } finally {
      setVerifying(false);
    }
  };

  /**
   * 重新发送验证码
   * 重新调用 signUp 触发邮件发送
   */
  const handleResend = async () => {
    if (!canResend) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signup(email, password, name);
      if (result.error) {
        setError(result.error);
      } else {
        startCountdown();
        setOtpValues(Array(OTP_LENGTH).fill(""));
        setSuccess(
          t.lang === "EN"
            ? "验证码已重新发送，请查收邮箱。"
            : "A new verification code has been sent to your email."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 返回注册表单（从 OTP 验证码界面退出）
   */
  const handleBackToForm = () => {
    setShowOtpView(false);
    setOtpValues(Array(OTP_LENGTH).fill(""));
    setError(null);
    setSuccess(null);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    await loginWithGoogle();
  };

  // OTP 输入完毕自动触发验证
  useEffect(() => {
    if (showOtpView && otpValues.every((v) => v !== "")) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpValues, showOtpView]);

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
          width: 420, padding: 40, background: "#fff",
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
            {showOtpView
              ? (t.lang === "EN" ? "邮箱验证" : "Email Verification")
              : (isSignup ? t.signup : t.login)}
          </h1>
          <p style={{ fontSize: 14, color: S.colors.text3, margin: 0 }}>
            {showOtpView
              ? (t.lang === "EN" ? `验证码已发送至 ${email}` : `Code sent to ${email}`)
              : t.tagSub}
          </p>
        </div>

        {/* 错误 / 成功提示 */}
        {error && (
          <div
            style={{
              padding: "10px 14px", borderRadius: 10,
              background: S.colors.redBg, color: S.colors.red,
              fontSize: 13, marginBottom: 16,
              animation: "fadeIn 0.25s ease forwards",
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: "10px 14px", borderRadius: 10,
              background: S.colors.greenBg, color: S.colors.green,
              fontSize: 13, marginBottom: 16,
              animation: "fadeIn 0.25s ease forwards",
            }}
          >
            {success}
          </div>
        )}

        {/* ─── OTP 验证码输入界面 ─── */}
        {showOtpView ? (
          <div className="animate-fade-in">
            {/* 验证码图标 */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: S.colors.accentLight,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28,
                }}
              >
                ✉️
              </div>
            </div>

            {/* 6 位验证码输入框 */}
            <OtpInput
              value={otpValues}
              onChange={setOtpValues}
              disabled={verifying}
            />

            {/* 验证按钮 */}
            <button
              id="btn-verify-otp"
              onClick={handleVerify}
              disabled={verifying || otpValues.join("").length !== OTP_LENGTH}
              style={{
                width: "100%", padding: "12px 0", marginTop: 24,
                borderRadius: 10, border: "none",
                background: verifying || otpValues.join("").length !== OTP_LENGTH
                  ? S.colors.text3
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                fontWeight: 600, fontSize: 14,
                cursor: verifying ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease",
              }}
            >
              {verifying
                ? (t.lang === "EN" ? "验证中..." : "Verifying...")
                : (t.lang === "EN" ? "验证" : "Verify")}
            </button>

            {/* 重发验证码按钮 */}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                id="btn-resend-otp"
                onClick={handleResend}
                disabled={!canResend || loading}
                style={{
                  background: "none", border: "none",
                  color: canResend ? S.colors.accent : S.colors.text3,
                  fontSize: 13, cursor: canResend ? "pointer" : "default",
                  fontFamily: "inherit",
                  transition: "color 0.2s ease",
                }}
              >
                {canResend
                  ? (t.lang === "EN" ? "重新发送验证码" : "Resend code")
                  : (t.lang === "EN"
                    ? `${countdown}s 后可重新发送`
                    : `Resend in ${countdown}s`)}
              </button>
            </div>

            {/* 返回注册表单 */}
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                id="btn-back-to-form"
                onClick={handleBackToForm}
                style={{
                  background: "none", border: "none",
                  color: S.colors.text3, fontSize: 13,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ← {t.lang === "EN" ? "返回修改邮箱" : "Back to edit email"}
              </button>
            </div>
          </div>
        ) : (
          /* ─── 原有登录/注册表单 ─── */
          <>
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
                  background: loading ? S.colors.text3 : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff",
                  fontWeight: 600, fontSize: 14,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s ease",
                }}
              >
                {loading ? "..." : isSignup ? t.signup : t.login}
              </button>
            </form>

            {/* 切换登录/注册 */}
            <div style={{ textAlign: "center", margin: "16px 0", fontSize: 13, color: S.colors.text3 }}>
              {isSignup
                ? <>{t.lang === "EN" ? "已有账号？" : "Already have an account?"} <button onClick={() => { setIsSignup(false); setError(null); setSuccess(null); }} style={{ background: "none", border: "none", color: S.colors.accent, cursor: "pointer", fontSize: 13 }}>{t.login}</button></>
                : <>{t.lang === "EN" ? "没有账号？" : "No account?"} <button onClick={() => { setIsSignup(true); setError(null); setSuccess(null); }} style={{ background: "none", border: "none", color: S.colors.accent, cursor: "pointer", fontSize: 13 }}>{t.signup}</button></>
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
          </>
        )}
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
