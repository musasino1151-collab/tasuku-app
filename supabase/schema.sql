-- =====================================================================
--  チームタスク管理アプリ  データベース定義
--  Supabase の「SQL Editor」に全文を貼り付けて 1 回だけ実行してください。
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- 非公開の設定テーブル（APIからは見えない）
--   functions_url : https://<project-ref>.supabase.co/functions/v1
--   email_secret  : Edge Function と共有する任意の長い文字列
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key   text primary key,
  value text not null
);

-- ---------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  name         text not null,
  color        text not null default '#f06a6a',
  email_notify boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#4186e0',
  description text not null default '',
  archived    boolean not null default false,
  position    double precision not null default 0,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.sections (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects(id) on delete cascade,
  section_id   uuid references public.sections(id) on delete set null,
  parent_id    uuid references public.tasks(id) on delete cascade,
  title        text not null default '',
  description  text not null default '',
  assignee_id  uuid references public.profiles(id) on delete set null,
  due_date     date,
  priority     text check (priority in ('high', 'medium', 'low')),
  completed    boolean not null default false,
  completed_at timestamptz,
  position     double precision not null default 0,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  body       text not null,
  created_at timestamptz not null default now()
);

create table public.activities (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  kind       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  task_id    uuid references public.tasks(id) on delete cascade,
  kind       text not null,          -- assigned | comment | completed | due_today | due_tomorrow
  body       text not null default '',
  ref_date   date,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index on public.sections (project_id);
create index on public.tasks (project_id);
create index on public.tasks (assignee_id);
create index on public.tasks (parent_id);
create index on public.tasks (due_date) where not completed;
create index on public.comments (task_id);
create index on public.activities (task_id);
create index on public.notifications (user_id, created_at desc);
create unique index notifications_due_once
  on public.notifications (task_id, user_id, kind, ref_date) where ref_date is not null;

-- ---------------------------------------------------------------------
-- 新規ユーザー → profiles 自動作成
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, color)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    (array['#f06a6a','#f1bd6c','#62d26f','#4ecbc4','#4186e0','#aa62e3','#e362e3','#ea4e9d'])[1 + floor(random() * 8)::int]
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 既に作成済みのユーザーを取り込む
insert into public.profiles (id, email, name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- タスク：更新日時・完了日時
-- ---------------------------------------------------------------------
create or replace function public.tasks_before_write()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.completed and (tg_op = 'INSERT' or not old.completed) then
    new.completed_at := now();
  elsif not new.completed then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ---------------------------------------------------------------------
-- タスク：アクティビティ記録と通知
-- ---------------------------------------------------------------------
create or replace function public.tasks_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into activities (task_id, actor_id, kind) values (new.id, actor, 'created');
    if new.assignee_id is not null then
      insert into activities (task_id, actor_id, kind, data)
      values (new.id, actor, 'assigned', jsonb_build_object('to', new.assignee_id));
      if new.assignee_id is distinct from actor then
        insert into notifications (user_id, actor_id, task_id, kind, body)
        values (new.assignee_id, actor, new.id, 'assigned', new.title);
      end if;
    end if;
    return new;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into activities (task_id, actor_id, kind, data)
    values (new.id, actor, 'assigned', jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
    if new.assignee_id is not null and new.assignee_id is distinct from actor then
      insert into notifications (user_id, actor_id, task_id, kind, body)
      values (new.assignee_id, actor, new.id, 'assigned', new.title);
    end if;
  end if;

  if new.completed is distinct from old.completed then
    insert into activities (task_id, actor_id, kind)
    values (new.id, actor, case when new.completed then 'completed' else 'reopened' end);
    -- 依頼者（作成者）に完了を知らせる
    if new.completed and new.created_by is not null and new.created_by is distinct from actor then
      insert into notifications (user_id, actor_id, task_id, kind, body)
      values (new.created_by, actor, new.id, 'completed', new.title);
    end if;
  end if;

  if new.due_date is distinct from old.due_date then
    insert into activities (task_id, actor_id, kind, data)
    values (new.id, actor, 'due', jsonb_build_object('to', new.due_date));
  end if;

  if new.project_id is distinct from old.project_id then
    insert into activities (task_id, actor_id, kind, data)
    values (new.id, actor, 'moved', jsonb_build_object('to', new.project_id));
  end if;

  return new;
end $$;

create trigger tasks_after_write
  after insert or update on public.tasks
  for each row execute function public.tasks_after_write();

-- ---------------------------------------------------------------------
-- コメント → 担当者・作成者・過去のコメント投稿者に通知
-- ---------------------------------------------------------------------
create or replace function public.comments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t   tasks%rowtype;
  rid uuid;
begin
  select * into t from tasks where id = new.task_id;
  for rid in
    select distinct u from (
      select t.assignee_id as u
      union select t.created_by
      union select c.author_id from comments c where c.task_id = new.task_id
    ) x
    where u is not null and u is distinct from new.author_id
  loop
    insert into notifications (user_id, actor_id, task_id, kind, body)
    values (rid, new.author_id, new.task_id, 'comment', left(new.body, 1000));
  end loop;
  return new;
end $$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function public.comments_after_insert();

-- ---------------------------------------------------------------------
-- 通知 → Edge Function（Amazon SES）でメール送信
-- ---------------------------------------------------------------------
create or replace function public.notifications_send_email()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  fn_url     text;
  secret     text;
  rcpt       profiles%rowtype;
  actor_name text;
  t_title    text;
  t_due      date;
  p_name     text;
begin
  select value into fn_url from private.app_config where key = 'functions_url';
  select value into secret from private.app_config where key = 'email_secret';
  if fn_url is null or secret is null then return new; end if;

  select * into rcpt from profiles where id = new.user_id;
  if rcpt.id is null or not rcpt.email_notify then return new; end if;

  select name into actor_name from profiles where id = new.actor_id;
  select tk.title, tk.due_date, pr.name into t_title, t_due, p_name
    from tasks tk left join projects pr on pr.id = tk.project_id
   where tk.id = new.task_id;

  perform net.http_post(
    url     := rtrim(fn_url, '/') || '/send-email',
    body    := jsonb_build_object(
                 'to',           rcpt.email,
                 'recipient',    rcpt.name,
                 'actor',        actor_name,
                 'kind',         new.kind,
                 'body',         new.body,
                 'task_id',      new.task_id,
                 'task_title',   t_title,
                 'due_date',     t_due,
                 'project_name', p_name),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', secret)
  );
  return new;
end $$;

create trigger notifications_send_email
  after insert on public.notifications
  for each row execute function public.notifications_send_email();

-- ---------------------------------------------------------------------
-- 期限リマインド（毎朝 8:00 JST = 23:00 UTC）
--   当日期限 → due_today、翌日期限 → due_tomorrow
-- ---------------------------------------------------------------------
create or replace function public.enqueue_due_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  insert into notifications (user_id, task_id, kind, body, ref_date)
  select assignee_id, id,
         case when due_date = today then 'due_today' else 'due_tomorrow' end,
         title, due_date
    from tasks
   where not completed
     and assignee_id is not null
     and due_date in (today, today + 1)
  on conflict do nothing;
end $$;

revoke execute on function public.enqueue_due_reminders() from public, anon, authenticated;

select cron.schedule('due-reminders', '0 23 * * *', $$select public.enqueue_due_reminders()$$);

-- ---------------------------------------------------------------------
-- アクセス権（RLS）: ログインしたメンバーは全員すべてのプロジェクトを閲覧・編集可
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.sections      enable row level security;
alter table public.tasks         enable row level security;
alter table public.comments      enable row level security;
alter table public.activities    enable row level security;
alter table public.notifications enable row level security;

create policy "members read profiles" on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members all projects" on public.projects
  for all to authenticated using (true) with check (true);
create policy "members all sections" on public.sections
  for all to authenticated using (true) with check (true);
create policy "members all tasks" on public.tasks
  for all to authenticated using (true) with check (true);

create policy "members read comments" on public.comments
  for select to authenticated using (true);
create policy "write own comments" on public.comments
  for insert to authenticated with check (author_id = auth.uid());
create policy "edit own comments" on public.comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own comments" on public.comments
  for delete to authenticated using (author_id = auth.uid());

create policy "members read activities" on public.activities
  for select to authenticated using (true);

create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "update own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- リアルタイム配信
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.profiles, public.projects, public.sections, public.tasks,
  public.comments, public.activities, public.notifications;
