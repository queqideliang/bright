import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: 允许从 Supabase Storage 和 Speckle 加载图片资源
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "app.speckle.systems",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth 头像
      },
    ],
  },

  // NOTE: 生产部署时如需静态导出，取消注释下行（Netlify SSR 模式不需要）
  // output: "export",

  // 日志配置（dev 模式下显示详细日志）
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // NOTE: 极其重要：突破 Next.js 默认的 4MB 上传限制
  experimental: {
    serverActions: {
      bodySizeLimit: "2000mb",
    },
  },
};

export default nextConfig;
