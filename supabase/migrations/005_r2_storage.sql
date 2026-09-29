-- 添付ファイルの保存先を記録（'supabase' または 'r2'）と使用容量の集計
alter table public.attachments add column if not exists storage text not null default 'supabase';

create or replace function public.attachments_usage()
returns table (r2_bytes bigint, supabase_bytes bigint, files bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(size) filter (where storage = 'r2'), 0)::bigint,
         coalesce(sum(size) filter (where storage <> 'r2'), 0)::bigint,
         count(*)::bigint
    from attachments;
$$;
revoke execute on function public.attachments_usage() from public, anon;
grant execute on function public.attachments_usage() to authenticated;
