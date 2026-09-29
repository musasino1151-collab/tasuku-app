-- 開始日（期日の範囲指定）を追加
alter table public.tasks add column if not exists start_date date;
