// ================================================================
//  Speckle 支持格式白名单 — 全平台统一引用此模块
//  AI_READY: 支持 3D 查看 + AI 数据审计
//  VIEW_ONLY: 仅支持 3D 查看
// ================================================================

/**
 * Speckle 云端支持的 22 种 3D/BIM 格式分类
 * AI_READY 格式可执行 AI 审计分析，VIEW_ONLY 仅支持 3D 渲染
 */
export const SPECKLE_FORMATS = {
  AI_READY: ['ifc', 'rvt', 'nwc', 'nwd', 'dwg', 'dxf', 'skp', '3dm', 'dgn', 'stp', 'step'] as const,
  VIEW_ONLY: ['fbx', 'obj', 'ply', '3ds', '3mf', 'amf', 'sldprt', 'igs', 'iges', 'x', 'e57'] as const,
} as const;

/** 全部 22 种支持格式 */
export const ALL_FORMATS: string[] = [...SPECKLE_FORMATS.AI_READY, ...SPECKLE_FORMATS.VIEW_ONLY];

/** 最大文件大小 50MB（因云端临时限制） */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** 扩展名 → 大写格式名映射（用于数据库存储和 UI 显示） */
export const EXT_TO_FORMAT: Record<string, string> = {
  ifc: 'IFC', rvt: 'RVT', dwg: 'DWG', dxf: 'DXF',
  '3dm': '3DM', step: 'STEP', stp: 'STEP', iges: 'IGES', igs: 'IGES',
  e57: 'E57', skp: 'SKP', nwd: 'NWD', nwc: 'NWC',
  fbx: 'FBX', obj: 'OBJ', dgn: 'DGN',
  '3mf': '3MF', '3ds': '3DS', amf: 'AMF', x: 'DirectX',
  ply: 'PLY', sldprt: 'SLDPRT',
};

/**
 * 生成 HTML input 的 accept 属性值
 * @returns 形如 ".ifc,.rvt,.nwc,..." 的字符串
 */
export function getFileAcceptString(): string {
  return ALL_FORMATS.map((ext) => `.${ext}`).join(',');
}

/**
 * 判断指定格式是否支持 AI 审计
 * @param ext 小写扩展名
 */
export function isAiReady(ext: string): boolean {
  return (SPECKLE_FORMATS.AI_READY as readonly string[]).includes(ext.toLowerCase());
}
