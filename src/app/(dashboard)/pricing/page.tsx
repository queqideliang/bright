// ================================================================
//  定价页 — 展示三档方案（Free / Pro / Enterprise）
//  NOTE: 支付集成预留 Lemon Squeezy 接口，Key 到位后替换 handleUpgradeToPro
// ================================================================

"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { IconCheck } from "@/components/icons";
import { S } from "@/lib/constants";

// ── Lemon Squeezy 集成预留 ──────────────────────────────────────
// TODO: 填入 Lemon Squeezy 的 Store/Product 配置后取消注释
// const LEMON_SQUEEZY_PRO_VARIANT_ID = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_PRO_VARIANT_ID;
// const LEMON_SQUEEZY_STORE_ID      = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_ID;

/**
 * 创建 Lemon Squeezy Checkout（预留接口，Key 到位后激活）
 * @param variantId Lemon Squeezy Product Variant ID
 * @param userEmail 当前用户邮箱（预填到结算表单）
 */
async function createLemonCheckout(variantId: string, userEmail?: string): Promise<string | null> {
  // TODO: 接入时取消注释并实现
  // const resp = await fetch("/api/lemon/checkout", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ variantId, userEmail }),
  // });
  // const data = await resp.json();
  // return data.checkoutUrl ?? null;
  console.log("[Lemon Squeezy] checkout placeholder — variantId:", variantId, "email:", userEmail);
  return null;
}
// ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { t, user } = useApp();
  const [loadingPro, setLoadingPro] = useState(false);

  const plans = [
    {
      id: "free",
      name: t.free,
      price: t.free_price,
      features: [t.f1, t.f2, t.f3, t.f4],
      action: t.current_plan,
      highlighted: false,
      disabled: true,
      badge: null,
    },
    {
      id: "pro",
      name: t.pro,
      price: t.pro_price,
      features: [t.p1, t.p2, t.p3, t.p4, t.p5, t.p6],
      action: t.upgrade,
      highlighted: true,
      disabled: false,
      // TODO: 替换为真实 Lemon Squeezy Variant ID
      lemonVariantId: "VARIANT_ID_PLACEHOLDER",
      badge: t.recommended,
    },
    {
      id: "enterprise",
      name: t.enterprise,
      price: t.ent_price,
      features: [t.e1, t.e2, t.e3, t.e4, t.e5, t.e6],
      action: t.contact_sales,
      highlighted: false,
      disabled: false,
      badge: null,
    },
  ] as const;

  /** 处理 Pro 升级（预留 Lemon Squeezy 集成点） */
  const handleUpgradePro = async (lemonVariantId: string) => {
    setLoadingPro(true);
    try {
      const checkoutUrl = await createLemonCheckout(lemonVariantId, user?.email);

      if (checkoutUrl) {
        // Lemon Squeezy 已配置 → 跳转到结算页
        window.location.href = checkoutUrl;
      } else {
        // 未配置时，引导联系邮箱
        const msg =
          t.lang === "EN"
            ? "🚀 PRO 在线支付即将开通！\n如需立即升级，请联系：me@brightsunliang.top"
            : "🚀 PRO online payment coming soon!\nFor immediate access, contact: me@brightsunliang.top";
        alert(msg);
      }
    } finally {
      setLoadingPro(false);
    }
  };

  const handleCTA = (plan: (typeof plans)[number]) => {
    if (plan.disabled) return;
    if (plan.id === "enterprise") {
      window.location.href = "mailto:me@brightsunliang.top?subject=Enterprise%20Plan%20Inquiry";
      return;
    }
    if (plan.id === "pro" && "lemonVariantId" in plan) {
      handleUpgradePro(plan.lemonVariantId);
    }
  };

  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      {/* 页头 */}
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: S.colors.text,
            margin: "0 0 10px",
            letterSpacing: "-0.03em",
          }}
        >
          {t.pricing_title}
        </h1>
        <p style={{ fontSize: 14, color: S.colors.text3, margin: 0 }}>{t.pricing_sub}</p>
      </div>

      {/* 套餐卡片 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22 }}>
        {plans.map((p, i) => (
          <div
            key={i}
            id={`pricing-card-${p.id}`}
            style={{
              padding: 30,
              borderRadius: 18,
              background: "#fff",
              border: p.highlighted ? `2px solid ${S.colors.accent}` : `1px solid ${S.colors.border}`,
              boxShadow: p.highlighted ? "0 8px 32px rgba(99,102,241,.12)" : "none",
              position: "relative",
              transition: "box-shadow .2s",
            }}
          >
            {/* 推荐标签 */}
            {p.badge && (
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  padding: "4px 16px",
                  borderRadius: 14,
                  background: `linear-gradient(135deg, #6366f1, #8b5cf6)`,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {p.badge}
              </div>
            )}

            {/* 套餐名称 */}
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: p.highlighted ? S.colors.accent : S.colors.text,
                marginBottom: 6,
              }}
            >
              {p.name}
            </div>

            {/* 价格 */}
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: S.colors.text,
                marginBottom: 24,
                letterSpacing: "-0.03em",
              }}
            >
              {p.price}
            </div>

            {/* 功能列表 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 28 }}>
              {p.features.map((f, j) => (
                <div
                  key={j}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: S.colors.text2 }}
                >
                  <span style={{ color: S.colors.green, flexShrink: 0, marginTop: 1 }}>
                    <IconCheck size={14} />
                  </span>
                  {f}
                </div>
              ))}
            </div>

            {/* CTA 按钮 */}
            <button
              id={`btn-pricing-cta-${p.id}`}
              onClick={() => handleCTA(p)}
              disabled={p.disabled || (p.id === "pro" && loadingPro)}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 10,
                border: p.highlighted || p.disabled ? "none" : `1.5px solid ${S.colors.accent}`,
                cursor: p.disabled || loadingPro ? "default" : "pointer",
                background: p.highlighted
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : p.disabled
                  ? S.colors.bg3
                  : "transparent",
                color: p.highlighted ? "#fff" : p.disabled ? S.colors.text3 : S.colors.accent,
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
                letterSpacing: "0.01em",
                transition: "opacity .15s",
                opacity: p.id === "pro" && loadingPro ? 0.6 : 1,
              }}
            >
              {p.id === "pro" && loadingPro ? "..." : p.action}
            </button>

            {/* Pro 方案：即将上线提示 */}
            {p.id === "pro" && (
              <div
                style={{
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: 11,
                  color: S.colors.text3,
                }}
              >
                {t.lang === "EN" ? "在线支付即将开通" : "Online payment coming soon"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部说明 */}
      <div
        style={{
          marginTop: 36,
          padding: "16px 20px",
          borderRadius: 12,
          background: S.colors.bg3,
          border: `1px solid ${S.colors.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          color: S.colors.text2,
        }}
      >
        <span style={{ fontSize: 18 }}>💬</span>
        <span>
          {t.lang === "EN"
            ? "如需立即开通 Pro，请发送邮件至 "
            : "For immediate Pro access, email "}
          <a
            href="mailto:me@brightsunliang.top"
            style={{ color: S.colors.accent, fontWeight: 600, textDecoration: "none" }}
          >
            me@brightsunliang.top
          </a>
        </span>
      </div>
    </div>
  );
}
