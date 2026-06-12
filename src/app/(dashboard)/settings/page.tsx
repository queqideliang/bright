"use client";

import { useApp } from "@/lib/app-context";
import { S } from "@/lib/constants";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { User as UserIcon, Lock, CreditCard, Mail, Shield, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const { t, user, supabaseUser } = useApp();
  const supabase = createClient();
  
  const [fullName, setFullName] = useState(user?.name || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (user?.name) setFullName(user.name);
  }, [user?.name]);

  const handleUpdateProfile = async () => {
    setIsUpdatingName(true);
    setNameMessage("");
    try {
      // 1. 更新 auth.users metadata
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, name: fullName }
      });
      if (error) throw error;
      
      // 2. 尝试同步更新 profiles 表 (如果存在该表的话)
      if (supabaseUser) {
         await supabase.from("profiles").update({ full_name: fullName }).eq("id", supabaseUser.id);
      }
      
      setNameMessage("个人信息更新成功！");
      setTimeout(() => setNameMessage(""), 3000);
    } catch (err: any) {
      setNameMessage("更新失败：" + err.message);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage("密码至少需要 6 个字符");
      return;
    }
    setIsUpdatingPassword(true);
    setPasswordMessage("");
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      setPasswordMessage("密码修改成功！");
      setNewPassword("");
      setTimeout(() => setPasswordMessage(""), 3000);
    } catch (err: any) {
      setPasswordMessage("修改失败：" + err.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px", background: "transparent",
    border: `1px solid ${S.colors.border}`, borderRadius: 8, fontSize: 14,
    color: S.colors.text, outline: "none", transition: "border-color 0.2s"
  };
  
  return (
    <div style={{ maxWidth: 640, paddingBottom: 40 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: S.colors.text, margin: "0 0 24px" }}>
        {t.nav_settings}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* 个人信息卡片 */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${S.colors.border}`, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${S.colors.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <UserIcon size={18} color={S.colors.accent} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: S.colors.text, margin: 0 }}>个人信息</h2>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
               <div style={{
                 width: 64, height: 64, borderRadius: "50%",
                 background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                 display: "flex", alignItems: "center", justifyContent: "center",
                 color: "#fff", fontSize: 24, fontWeight: 700
               }}>
                 {fullName?.[0]?.toUpperCase() ?? "U"}
               </div>
               <div>
                 <div style={{ fontWeight: 700, fontSize: 18, color: S.colors.text }}>{fullName || "User"}</div>
                 <div style={{ fontSize: 13, color: S.colors.text3, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={14} />
                    {user?.email}
                 </div>
               </div>
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: S.colors.text2, marginBottom: 6 }}>
                显示名称
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
                placeholder="请输入您的姓名"
              />
            </div>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: nameMessage.includes("成功") ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                {nameMessage && (nameMessage.includes("成功") && <CheckCircle2 size={16} />)}
                {nameMessage}
              </span>
              <Button onClick={handleUpdateProfile} disabled={isUpdatingName || !fullName}>
                {isUpdatingName ? "保存中..." : "保存更改"}
              </Button>
            </div>
          </div>
        </div>

        {/* 安全设置卡片 */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${S.colors.border}`, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${S.colors.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={18} color={S.colors.accent} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: S.colors.text, margin: 0 }}>安全设置</h2>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: S.colors.text2, marginBottom: 6 }}>
                修改密码
              </label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle}
                placeholder="请输入新密码（至少 6 个字符）"
              />
              <p style={{ fontSize: 12, color: S.colors.text3, marginTop: 8, margin: 0 }}>您可以使用新密码登录您的账户。</p>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: passwordMessage.includes("成功") ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                {passwordMessage && (passwordMessage.includes("成功") && <CheckCircle2 size={16} />)}
                {passwordMessage}
              </span>
              <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !newPassword}>
                {isUpdatingPassword ? "更新中..." : "更新密码"}
              </Button>
            </div>
          </div>
        </div>

        {/* 订阅套餐卡片 */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${S.colors.border}`, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${S.colors.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <CreditCard size={18} color={S.colors.accent} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: S.colors.text, margin: 0 }}>订阅套餐</h2>
          </div>
          <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                 <span style={{ fontWeight: 700, fontSize: 15, color: S.colors.text }}>当前套餐：</span>
                 <span style={{ padding: "4px 10px", borderRadius: 20, background: S.colors.accentLight, color: S.colors.accent, fontSize: 12, fontWeight: 700 }}>
                   FREE
                 </span>
              </div>
              <div style={{ fontSize: 13, color: S.colors.text3 }}>您可以随时升级到 Pro 套餐以解锁全部功能。</div>
            </div>
            <Button variant="outline" onClick={() => window.location.href = "/pricing"}>
              升级套餐
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
