// ================================================================
//  类型定义 — BIM AI 平台核心数据类型
// ================================================================

export type Lang = "zh" | "en";

export type ProjectStatus = "done" | "auditing" | "parsing" | "view_only" |
  "PENDING" | "PARSING" | "AUDITING" | "COMPLETED" | "FAILED";

/** Speckle 全部 22 种格式 + 兼容显示名 */
export type FileFormat =
  | "IFC" | "RVT" | "FBX" | "OBJ" | "GLB" | "GLTF"
  | "DWG" | "DXF" | "3DM" | "STEP" | "IGES" | "E57"
  | "SKP" | "NWD" | "NWC" | "DGN" | "3MF" | "3DS"
  | "AMF" | "DirectX" | "PLY" | "SLDPRT";

export interface Project {
  id: number | string;
  name: string;
  format: FileFormat;
  /** 构件数量，VIEW_ONLY 时为 0 */
  elements: number;
  status: ProjectStatus;
  /** 进度百分比 0-100 */
  progress: number;
  date: string;
  /** Speckle 项目/流 ID（用于嵌入 Viewer） */
  speckleStreamId?: string;
  /** Speckle 模型 ID */
  speckleModelId?: string;
  /** 标识该项是具体的模型还是无模型的空项目 */
  isModel?: boolean;
  /** Speckle 导入任务 ID，用于轮询状态 */
  importJobId?: string;
  /** 导入状态：pending / processing / ready / failed */
  importStatus?: string;
}

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

export interface User {
  name: string;
  email: string;
}

/** Supabase 返回的模型数据结构 */
export interface SupabaseModel {
  id: string;
  name: string;
  file_type: FileFormat;
  speckle_stream_id: string | null;
  speckle_model_id: string | null;
  status: string;
  progress: number;
  element_count: number;
  created_at: string;
  updated_at: string;
  /** Speckle 文件导入任务 ID */
  import_job_id: string | null;
  /** 导入状态：pending / processing / ready / failed */
  import_status: string | null;
  /** 导入失败时的错误信息 */
  import_error: string | null;
}

/** Supabase 返回的项目数据结构（含嵌套模型） */
export interface SupabaseProject {
  id: string;
  name: string;
  description: string;
  created_at: string;
  models: SupabaseModel[];
}

/** 翻译字典的单语言 key-value 结构 */
export interface Translations {
  brand: string;
  tagSub: string;
  hero1: string;
  hero2: string;
  heroSub: string;
  cta: string;
  ctaDemo: string;
  feat1t: string; feat1d: string;
  feat2t: string; feat2d: string;
  feat3t: string; feat3d: string;
  feat4t: string; feat4d: string;
  statModels: string; statUsers: string; statTime: string;
  login: string; signup: string; email: string; password: string;
  loginWith: string;
  nav_dash: string; nav_viewer: string; nav_pricing: string; nav_settings: string;
  dash_welcome: string;
  dash_quick: string;
  dash_upload: string; dash_audit: string; dash_export: string;
  dash_active: string;
  dash_stats: string;
  upload_title: string;
  upload_hint: string;
  upload_formats: string;
  upload_note_full: string;
  upload_note_view: string;
  viewer_ai: string;
  viewer_ai_ready: string;
  viewer_placeholder: string;
  viewer_fbx_note: string;
  pricing_title: string;
  pricing_sub: string;
  free: string; pro: string; enterprise: string;
  free_price: string; pro_price: string; ent_price: string;
  per_month: string;
  current_plan: string;
  upgrade: string;
  contact_sales: string;
  f1: string; f2: string; f3: string; f4: string;
  p1: string; p2: string; p3: string; p4: string; p5: string; p6: string;
  e1: string; e2: string; e3: string; e4: string; e5: string; e6: string;
  logout: string;
  models_count: string;
  status_done: string;
  status_auditing: string;
  status_parsing: string;
  status_view_only: string;
  lang: string;
  col_project: string;
  col_format: string;
  col_elements: string;
  col_status: string;
  col_date: string;
  stat_total_projects: string;
  stat_elements: string;
  stat_audits_done: string;
  stat_completeness: string;
  q1: string; q2: string; q3: string;
  view: string;
  recommended: string;
}
