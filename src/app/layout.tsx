import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "亮阳 BIM·AI — 智能建筑审计平台 | brightsunliang.top",
  description: "上传 IFC / RVT / FBX，10秒获得专业 AI BIM 审计报告。自动检查防火等级、LEED 合规、参数缺失。",
  keywords: "BIM 审计, AI 建筑, IFC, Revit, Speckle, LEED",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={inter.className} style={{ margin: 0, padding: 0 }}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
