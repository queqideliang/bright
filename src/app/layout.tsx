import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";

export const metadata: Metadata = {
  title: "BRIGHT VISION · BIM 模型工作台",
  icons: { icon: '/brand-mark.svg' },
  description: "在同一工作台打开 IFC 和 BRIGHT VISION ZIP，浏览模型与构件属性，检查信息、定位问题并导出审核结果。",
  keywords: "BIM 模型审核, IFC, Revit, BRIGHT VISION, 模型查看",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
