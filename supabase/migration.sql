-- ================================================================
-- 数据库迁移：扩展 Speckle 22 种格式支持
-- 请在 Supabase Dashboard → SQL Editor 中手动执行此脚本
-- ================================================================

-- ① models 表：放宽 file_type CHECK 约束，支持 Speckle 全部 22 种格式
ALTER TABLE models DROP CONSTRAINT IF EXISTS models_file_type_check;

ALTER TABLE models ADD CONSTRAINT models_file_type_check
CHECK (lower(file_type) IN (
  'ifc','rvt','3dm','skp','dwg','dxf','dgn','3ds','sldprt',
  'stp','step','e57','3mf','amf','fbx','igs','iges',
  'obj','ply','x','nwc','nwd'
));

-- ② models 表：新增 Speckle 导入相关字段
ALTER TABLE models ADD COLUMN IF NOT EXISTS speckle_model_id text;
ALTER TABLE models ADD COLUMN IF NOT EXISTS speckle_version_id text;
ALTER TABLE models ADD COLUMN IF NOT EXISTS import_job_id text;
ALTER TABLE models ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'pending';
ALTER TABLE models ADD COLUMN IF NOT EXISTS import_error text;

-- ③ projects 表：新增 speckle_project_id 字段，用于映射 Speckle 项目
ALTER TABLE projects ADD COLUMN IF NOT EXISTS speckle_project_id text;
