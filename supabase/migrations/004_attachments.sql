-- ファイル添付
-- Supabase の SQL Editor で 1 回実行してください（何度実行しても大丈夫です）

-- 1) 添付ファイルの情報を入れるテーブル
create table if not exists public.attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  name        text not null,
  size        bigint not null default 0,
  mime        text not null default '',
  path        text not null unique,
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists attachments_task_id_idx on public.attachments (task_id);

alter table public.attachments enable row level security;
drop policy if exists "members read attachments" on public.attachments;
drop policy if exists "members add attachments" on public.attachments;
drop policy if exists "members delete attachments" on public.attachments;
create policy "members read attachments" on public.attachments
  for select to authenticated using (true);
create policy "members add attachments" on public.attachments
  for insert to authenticated with check (uploaded_by = auth.uid());
create policy "members delete attachments" on public.attachments
  for delete to authenticated using (true);

-- 2) 添付したら履歴に残す
create or replace function public.attachments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into activities (task_id, actor_id, kind, data)
  values (new.task_id, new.uploaded_by, 'attached', jsonb_build_object('name', new.name));
  return new;
end $$;
drop trigger if exists attachments_after_insert on public.attachments;
create trigger attachments_after_insert
  after insert on public.attachments
  for each row execute function public.attachments_after_insert();

-- 3) リアルタイム配信に追加
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments') then
    alter publication supabase_realtime add table public.attachments;
  end if;
end $$;

-- 4) ファイル置き場（非公開・1ファイル 50MB まで）
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "members read attachment files" on storage.objects;
drop policy if exists "members upload attachment files" on storage.objects;
drop policy if exists "members delete attachment files" on storage.objects;
create policy "members read attachment files" on storage.objects
  for select to authenticated using (bucket_id = 'attachments');
create policy "members upload attachment files" on storage.objects
  for insert to authenticated with check (bucket_id = 'attachments');
create policy "members delete attachment files" on storage.objects
  for delete to authenticated using (bucket_id = 'attachments');
