// ================================================================
//  BIM 数据摘要展示组件 — 用于展示构件统计、楼层等元数据
// ================================================================

import { S } from "@/lib/constants";

interface BimSummaryProps {
  data: {
    total_elements: number;
    levels: { name: string; elevation_mm?: number }[];
    category_stats: Record<string, number>;
  };
}

export function BimSummary({ data }: BimSummaryProps) {
  const categories = Object.entries(data.category_stats).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto", background: "#f8fafc" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: S.colors.text, marginBottom: 20 }}>模型数据概览</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, borderRadius: 12, background: "#fff", border: `1px solid ${S.colors.border}` }}>
          <div style={{ fontSize: 12, color: S.colors.text3, marginBottom: 4 }}>总构件数</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: S.colors.accent }}>{data.total_elements.toLocaleString()}</div>
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: "#fff", border: `1px solid ${S.colors.border}` }}>
          <div style={{ fontSize: 12, color: S.colors.text3, marginBottom: 4 }}>解析状态</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.colors.green }}>✅ 解析完成</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* 构件分类统计 */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: S.colors.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            📊 构件分类统计
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.slice(0, 10).map(([cat, count], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${S.colors.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: S.colors.text2 }}>{cat}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: S.colors.text }}>{count}</span>
              </div>
            ))}
            {categories.length > 10 && (
              <div style={{ fontSize: 11, color: S.colors.text3, textAlign: "center", marginTop: 4 }}>
                + 还有 {categories.length - 10} 个类别...
              </div>
            )}
          </div>
        </div>

        {/* 楼层信息 */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: S.colors.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            🏢 楼层/标高
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.levels.length > 0 ? (
              data.levels.map((lvl, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: S.colors.blueBg, borderRadius: 8, border: `1px solid ${S.colors.blue}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: S.colors.blue }}>{lvl.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: S.colors.text3 }}>
                    {lvl.elevation_mm !== undefined ? `${lvl.elevation_mm} mm` : "—"}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: S.colors.text3, fontSize: 12, border: `1px dashed ${S.colors.border}`, borderRadius: 8 }}>
                未提取到楼层信息
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
