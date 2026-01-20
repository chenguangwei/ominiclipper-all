-- 1. 创建用户档案表 (Public Profiles)
-- 该表通过 Trigger 自动同步 auth.users 的数据
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  is_pro boolean default false, -- 核心：标记是否为付费用户
  stripe_customer_id text,      -- 预留：Stripe 支付 ID
  subscription_tier text default 'free', -- free, pro, team
  usage_tokens_this_month bigint default 0, -- 预留：AI Token 用量统计
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 开启 RLS (Row Level Security) - 这一步至关重要！
alter table public.profiles enable row level security;

-- 策略：用户只能看和改自己的档案
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- 2. 自动创建 Profile 的 Trigger
-- 当用户注册时，自动在 public.profiles 建一行数据
create function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. 资源表 (Resources/Items)
create table public.resources (
  id text not null primary key, -- 使用应用生成的 UUID，不依赖数据库自增
  user_id uuid references auth.users not null, -- 归属权
  title text not null,
  type text not null,
  content_snippet text,
  is_starred boolean default false,
  folder_id text, -- 这里的 folder_id 是应用层的 ID，不是外键（为了离线兼容）
  tags text[],    -- 简单起见使用数组，严谨可用关联表
  path text,      -- 云端存储路径或原始 URL
  file_size bigint,
  mime_type text,
  storage_mode text, -- 'reference' or 'embed' or 'cloud'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz -- 软删除支持
);

-- 开启 RLS
alter table public.resources enable row level security;

-- 策略：用户只能操作自己的资源
create policy "Users can CRUD own resources" on resources
  for all using (auth.uid() = user_id);

-- 4. 文件夹表 (Folders)
create table public.folders (
  id text not null primary key,
  user_id uuid references auth.users not null,
  name text not null,
  parent_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table public.folders enable row level security;
create policy "Users can CRUD own folders" on folders for all using (auth.uid() = user_id);

-- 5. 标签表 (Tags)
create table public.tags (
  id text not null primary key,
  user_id uuid references auth.users not null,
  name text not null,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tags enable row level security;
create policy "Users can CRUD own tags" on tags for all using (auth.uid() = user_id);