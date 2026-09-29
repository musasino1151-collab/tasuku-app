-- コメントのメンション（@名前）対応
alter table public.comments add column if not exists mentions uuid[] not null default '{}';

create or replace function public.comments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t   tasks%rowtype;
  rid uuid;
begin
  select * into t from tasks where id = new.task_id;

  -- メンションされた人には「メンション」として通知
  for rid in
    select distinct u from unnest(coalesce(new.mentions, '{}')) as u
    where u is distinct from new.author_id
      and exists (select 1 from profiles p where p.id = u)
  loop
    insert into notifications (user_id, actor_id, task_id, kind, body)
    values (rid, new.author_id, new.task_id, 'mention', left(new.body, 1000));
  end loop;

  -- 担当者・作成者・過去のコメント投稿者には「コメント」として通知（メンション済みの人は除く）
  for rid in
    select distinct u from (
      select t.assignee_id as u
      union select t.created_by
      union select c.author_id from comments c where c.task_id = new.task_id
    ) x
    where u is not null
      and u is distinct from new.author_id
      and not (u = any (coalesce(new.mentions, '{}')))
  loop
    insert into notifications (user_id, actor_id, task_id, kind, body)
    values (rid, new.author_id, new.task_id, 'comment', left(new.body, 1000));
  end loop;
  return new;
end $$;
