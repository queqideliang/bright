-- ================================================================
--  亮阳 BIM·AI 平台 — Supabase 数据库 Schema
--  在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ================================================================

-- ── 1. 用户扩展表（关联 auth.users）──
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  plan text default 'FREE' check (plan in ('FREE', 'PRO')),
  credits integer default 10,
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- 自动创建 profile 触发器
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. 项目表 ──
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text default '',
  created_at timestamptz default now()
);

-- ── 3. 模型表（核心） ──
create table if not exists public.models (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  file_type text not null check (file_type in ('IFC', 'RVT', 'FBX', 'OBJ', 'GLB', 'GLTF')),
  speckle_stream_id text,
  speckle_model_id text,
  status text default 'PENDING' check (status in ('PENDING', 'PARSING', 'AUDITING', 'COMPLETED', 'FAILED')),
  progress integer default 0 check (progress >= 0 and progress <= 100),
  element_count integer default 0,
  file_size_bytes bigint default 0,
  audit_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 4. 审计记录表 ──
create table if not exists public.audits (
  id uuid default gen_random_uuid() primary key,
  model_id uuid references public.models(id) on delete cascade not null,
  audit_report_json jsonb,
  status text default 'PENDING' check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ================================================================
--  RLS（行级安全策略）— 确保用户只能访问自己的数据
-- ================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.models enable row level security;
alter table public.audits enable row level security;

-- profiles: 用户只能读写自己的 profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- projects: 用户只能 CRUD 自己的项目
create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);
create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);

-- models: 通过 project 关联控制访问
create policy "Users can view own models" on public.models
  for select using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );
create policy "Users can insert own models" on public.models
  for insert with check (
    project_id in (select id from public.projects where user_id = auth.uid())
  );
create policy "Users can update own models" on public.models
  for update using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

create policy "Users can delete own models" on public.models
  for delete using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- audits: 通过 model → project 链条控制
create policy "Users can view own audits" on public.audits
  for select using (
    model_id in (
      select m.id from public.models m
      join public.projects p on m.project_id = p.id
      where p.user_id = auth.uid()
    )
  );

-- ================================================================
--  插入演示数据（可选，方便初次测试）
-- ================================================================
-- NOTE: 这些数据需要在用户注册后手动绑定 user_id
-- 或者通过前端 Dashboard 的 "上传" 功能创建
