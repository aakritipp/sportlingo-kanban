-- ═══════════════════════════════════════
-- TaskFlow Kanban — Supabase Schema
-- ═══════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tasks table
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority text default 'normal'
    check (priority in ('low', 'normal', 'high')),
  due_date date,
  labels text[] default '{}',
  assignee_ids text[] default '{}',
  user_id uuid not null,
  created_at timestamp with time zone default now()
);

-- Index for fast user lookups
create index idx_tasks_user_id on public.tasks (user_id);
create index idx_tasks_status on public.tasks (status);

-- ═══ Row Level Security ═══
alter table public.tasks enable row level security;

-- Users can only see their own tasks
create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

-- Users can only create tasks for themselves
create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

-- Users can only update their own tasks
create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

-- Users can only delete their own tasks
create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);
