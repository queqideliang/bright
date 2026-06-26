// ================================================================
//  定价页 — Free / Pro ($99/mo) / Project ($499/project)
//  Lemon Squeezy 直连结算
// ================================================================

"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { IconCheck } from "@/components/icons";
import { S } from "@/lib/constants";

export default function PricingPage() {
  const { t, user } = useApp();
  const [loading, setLoading] = useState<string | null>(null);

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "",
      features: [
        "3 compliance checks / month",
        "File naming validation (ISO 19650)",
        "Basic Uniclass 2015 check",
        "Community support",
      ],
      action: "Current Plan",
      highlighted: false,
      disabled: true,
      badge: null,
      lemonPlan: null,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$99",
      period: "/month",
      features: [
        "Unlimited compliance checks",
        "Full Uniclass 2015 validation",
        "EIR property completeness check",
        "AI Fix-it Guide (Revit steps)",
        "PDF audit report export",
        "Priority support",
      ],
      action: "Get Pro",
      highlighted: true,
      disabled: false,
      badge: "Most Popular",
      lemonPlan: "pro",
    },
    {
      id: "project",
      name: "Per Project",
      price: "$499",
      period: "/project",
      features: [
        "One-time payment per project",
        "Everything in Pro",
        "No subscription commitment",
        "Shareable PDF report",
        "BIM coordinator handover pack",
        "Email support",
      ],
      action: "Buy Project",
      highlighted: false,
      disabled: false,
      badge: null,
      lemonPlan: "project",
    },
  ] as const;

  const handleCTA = async (plan: (typeof plans)[number]) => {
    if (plan.disabled || !plan.lemonPlan) return;

    setLoading(plan.id);
    try {
      const resp = await fetch("/api/lemon/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.lemonPlan }),
      });
      const data = await resp.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      {/* 页头 */}
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: S.colors.text, margin: "0 0 10px", letterSpacing: "-0.03em" }}>
          {t.lang === "EN" ? "Stop failing CDE submissions" : "Stop failing CDE submissions"}
        </h1>
        <p style={{ fontSize: 14, color: S.colors.text3, margin: 0 }}>
          {t.lang === "EN"
            ? "Drop your IFC, get a fix-it list before the CDE rejects you."
            : "上传 IFC，在 CDE 打回来之前拿到修复清单。"}
        </p>
      </div>

      {/* 套餐卡片 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22 }}>
        {plans.map((p) => {
          const isLoading = loading === p.id;
          return (
            <div
              key={p.id}
              id={`pricing-card-${p.id}`}
              style={{
                padding: 30, borderRadius: 18, background: "#fff",
                border: p.highlighted ? `2px solid ${S.colors.accent}` : `1px solid ${S.colors.border}`,
                boxShadow: p.highlighted ? "0 8px 32px rgba(99,102,241,.12)" : "none",
                position: "relative",
              }}
            >
              {p.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  padding: "4px 16px", borderRadius: 14,
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                }}>
                  {p.badge}
                </div>
              )}

              <div style={{ fontSize: 15, fontWeight: 700, color: p.highlighted ? S.colors.accent : S.colors.text, marginBottom: 6 }}>
                {p.name}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 24 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: S.colors.text, letterSpacing: "-0.03em" }}>
                  {p.price}
                </span>
                {p.period && (
                  <span style={{ fontSize: 13, color: S.colors.text3 }}>{p.period}</span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 28 }}>
                {p.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: S.colors.text2 }}>
                    <span style={{ color: S.colors.green, flexShrink: 0, marginTop: 1 }}>
                      <IconCheck size={14} />
                    </span>
                    {f}
                  </div>
                ))}
              </div>

              <button
                id={`btn-pricing-cta-${p.id}`}
                onClick={() => handleCTA(p)}
                disabled={p.disabled || isLoading}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10,
                  border: p.highlighted || p.disabled ? "none" : `1.5px solid ${S.colors.accent}`,
                  cursor: p.disabled || isLoading ? "default" : "pointer",
                  background: p.highlighted
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : p.disabled ? S.colors.bg3 : "transparent",
                  color: p.highlighted ? "#fff" : p.disabled ? S.colors.text3 : S.colors.accent,
                  fontWeight: 700, fontSize: 13, fontFamily: "inherit",
                  opacity: isLoading ? 0.6 : 1, transition: "opacity .15s",
                }}
              >
                {isLoading ? "Redirecting..." : p.action}
              </button>
            </div>
          );
        })}
      </div>

      {/* 底部说明 */}
      <div style={{
        marginTop: 36, padding: "16px 20px", borderRadius: 12,
        background: S.colors.bg3, border: `1px solid ${S.colors.border}`,
        display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: S.colors.text2,
      }}>
        <span style={{ fontSize: 18 }}>💬</span>
        <span>
          Need a custom plan for your practice?{" "}
          <a href="mailto:me@brightsunliang.top" style={{ color: S.colors.accent, fontWeight: 600, textDecoration: "none" }}>
            me@brightsunliang.top
          </a>
        </span>
      </div>
    </div>
  );
}
