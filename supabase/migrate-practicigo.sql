-- Practicigo: rename the database objects from the melodigo_ prefix. Run once in the Supabase SQL editor, before the
-- db-rename branch is deployed. Data is untouched: the three tables are renamed in place; functions and policies are
-- dropped and recreated under the new names by the schema that follows. The audio bucket keeps its id 'melodigo-audio'
-- because every caption and recording URL already stored in pupils' documents embeds it; renaming it would break playback.
begin;

alter table if exists public.melodigo_studios  rename to practicigo_studios;
alter table if exists public.melodigo_members  rename to practicigo_members;
alter table if exists public.melodigo_students rename to practicigo_students;

drop policy if exists "melodigo members: read own or my studio as teacher" on public.practicigo_members;
drop policy if exists "melodigo studios: read mine" on public.practicigo_studios;
drop policy if exists "melodigo students: read own or my studio as teacher" on public.practicigo_students;
drop policy if exists "melodigo students: write own or my studio as teacher" on public.practicigo_students;
drop policy if exists "melodigo audio: public read" on storage.objects;
drop policy if exists "melodigo audio: members write" on storage.objects;
drop policy if exists "melodigo audio: members update" on storage.objects;
drop policy if exists "melodigo audio: members delete" on storage.objects;

drop function if exists public.melodigo_students_list();
drop function if exists public.melodigo_save_student(uuid, jsonb);
drop function if exists public.melodigo_create_studio(text, text);
drop function if exists public.melodigo_join_studio(text, text);
drop function if exists public.melodigo_me();
drop function if exists public.melodigo_set_voice(text, text);
drop function if exists public.melodigo_clear_voice();
drop function if exists public.melodigo_my_role();
drop function if exists public.melodigo_my_studio();

-- ---------------------------------------------------------------- the schema, new names (identical to supabase/schema.sql)
-- Practicigo: a studio is a teacher and their pupils. Each pupil's plan, sessions and flags live in one JSON document
-- that the pupil and their teacher can both read and write. Run once in the SQL editor. Every object is prefixed practicigo_.

create extension if not exists pgcrypto;

create table if not exists public.practicigo_studios (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.practicigo_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  studio_id uuid not null references public.practicigo_studios(id) on delete cascade,
  role text not null check (role in ('teacher','student')),
  name text,
  joined_at timestamptz not null default now()
);

create table if not exists public.practicigo_students (
  user_id uuid primary key references auth.users(id) on delete cascade,
  studio_id uuid not null references public.practicigo_studios(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.practicigo_studios enable row level security;
alter table public.practicigo_members enable row level security;
alter table public.practicigo_students enable row level security;

create or replace function public.practicigo_my_studio() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select studio_id from public.practicigo_members where user_id = auth.uid()
$$;
create or replace function public.practicigo_my_role() returns text
language sql stable security definer set search_path = public, extensions as $$
  select role from public.practicigo_members where user_id = auth.uid()
$$;

drop policy if exists "practicigo members: read own or my studio as teacher" on public.practicigo_members;
create policy "practicigo members: read own or my studio as teacher" on public.practicigo_members for select
  using (user_id = auth.uid() or (studio_id = public.practicigo_my_studio() and public.practicigo_my_role() = 'teacher'));

drop policy if exists "practicigo studios: read mine" on public.practicigo_studios;
create policy "practicigo studios: read mine" on public.practicigo_studios for select using (id = public.practicigo_my_studio());

drop policy if exists "practicigo students: read own or my studio as teacher" on public.practicigo_students;
create policy "practicigo students: read own or my studio as teacher" on public.practicigo_students for select
  using (user_id = auth.uid() or (studio_id = public.practicigo_my_studio() and public.practicigo_my_role() = 'teacher'));
drop policy if exists "practicigo students: write own or my studio as teacher" on public.practicigo_students;
create policy "practicigo students: write own or my studio as teacher" on public.practicigo_students for update
  using (user_id = auth.uid() or (studio_id = public.practicigo_my_studio() and public.practicigo_my_role() = 'teacher'))
  with check (user_id = auth.uid() or (studio_id = public.practicigo_my_studio() and public.practicigo_my_role() = 'teacher'));

-- A teacher creates a studio and gets a code to give pupils.
create or replace function public.practicigo_create_studio(studio_name text, teacher_name text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare sid uuid; scode text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.practicigo_members where user_id = auth.uid()) then raise exception 'You are already in a studio'; end if;
  scode := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.practicigo_studios (code, name, teacher_id) values (scode, coalesce(nullif(trim(studio_name),''), 'My studio'), auth.uid()) returning id into sid;
  insert into public.practicigo_members (user_id, studio_id, role, name) values (auth.uid(), sid, 'teacher', teacher_name);
  return scode;
end $$;

-- A pupil joins with the code and gets an empty plan document.
create or replace function public.practicigo_join_studio(join_code text, student_name text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare sid uuid; sname text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id, name into sid, sname from public.practicigo_studios where code = upper(trim(join_code));
  if sid is null then raise exception 'No studio with that code'; end if;
  insert into public.practicigo_members (user_id, studio_id, role, name) values (auth.uid(), sid, 'student', student_name)
    on conflict (user_id) do update set studio_id = excluded.studio_id, role = 'student', name = excluded.name;
  insert into public.practicigo_students (user_id, studio_id, data) values (auth.uid(), sid, jsonb_build_object('profile', jsonb_build_object('name', student_name)))
    on conflict (user_id) do update set studio_id = excluded.studio_id;
  return sname;
end $$;

-- What the signed-in user is: their role, studio name and code (code only for teachers).
create or replace function public.practicigo_me() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m record; s record;
begin
  if auth.uid() is null then return null; end if;
  select * into m from public.practicigo_members where user_id = auth.uid();
  if m is null then return null; end if;
  select * into s from public.practicigo_studios where id = m.studio_id;
  return jsonb_build_object('role', m.role, 'name', m.name, 'studio', s.name, 'code', case when m.role = 'teacher' then s.code else null end);
end $$;

-- Teacher: every pupil in my studio with their document. Pupil: just mine.
create or replace function public.practicigo_students_list() returns setof public.practicigo_students
language sql stable security definer set search_path = public, extensions as $$
  select * from public.practicigo_students
  where user_id = auth.uid() or (studio_id = public.practicigo_my_studio() and public.practicigo_my_role() = 'teacher')
  order by updated_at desc
$$;

-- Save a pupil's document. Pupils save their own; teachers save for pupils in their studio.
create or replace function public.practicigo_save_student(target uuid, doc jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if target <> auth.uid() and not (public.practicigo_my_role() = 'teacher' and exists (select 1 from public.practicigo_students where user_id = target and studio_id = public.practicigo_my_studio())) then
    raise exception 'Not your pupil';
  end if;
  update public.practicigo_students set data = doc, updated_at = now() where user_id = target;
end $$;

revoke execute on function public.practicigo_create_studio(text, text) from public, anon;
revoke execute on function public.practicigo_join_studio(text, text) from public, anon;
revoke execute on function public.practicigo_me() from public, anon;
revoke execute on function public.practicigo_students_list() from public, anon;
revoke execute on function public.practicigo_save_student(uuid, jsonb) from public, anon;
grant execute on function public.practicigo_create_studio(text, text) to authenticated;
grant execute on function public.practicigo_join_studio(text, text) to authenticated;
grant execute on function public.practicigo_me() to authenticated;
grant execute on function public.practicigo_students_list() to authenticated;
grant execute on function public.practicigo_save_student(uuid, jsonb) to authenticated;
grant execute on function public.practicigo_my_studio() to authenticated;
grant execute on function public.practicigo_my_role() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- v0.2: the teacher's voice. A studio can hold one cloned voice (ElevenLabs voice id), created from
-- a sample the teacher records with explicit consent, and deletable by the teacher at any time.
-- Synthesised captions are stored as audio files in a public bucket under the studio's folder.

alter table public.practicigo_studios add column if not exists voice_id text;
alter table public.practicigo_studios add column if not exists voice_name text;
alter table public.practicigo_studios add column if not exists voice_consent_at timestamptz;

create or replace function public.practicigo_set_voice(vid text, vname text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if public.practicigo_my_role() <> 'teacher' then raise exception 'Only the teacher can set the voice'; end if;
  update public.practicigo_studios set voice_id = vid, voice_name = vname, voice_consent_at = now() where id = public.practicigo_my_studio();
end $$;

create or replace function public.practicigo_clear_voice() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare old text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if public.practicigo_my_role() <> 'teacher' then raise exception 'Only the teacher can remove the voice'; end if;
  select voice_id into old from public.practicigo_studios where id = public.practicigo_my_studio();
  update public.practicigo_studios set voice_id = null, voice_name = null, voice_consent_at = null where id = public.practicigo_my_studio();
  return old;
end $$;

-- practicigo_me now also reports the studio id and whether a voice exists (the id itself only to the teacher).
create or replace function public.practicigo_me() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m record; s record;
begin
  if auth.uid() is null then return null; end if;
  select * into m from public.practicigo_members where user_id = auth.uid();
  if m is null then return null; end if;
  select * into s from public.practicigo_studios where id = m.studio_id;
  return jsonb_build_object(
    'role', m.role, 'name', m.name, 'studio', s.name, 'studio_id', s.id,
    'code', case when m.role = 'teacher' then s.code else null end,
    'voice_ready', s.voice_id is not null,
    'voice_id', case when m.role = 'teacher' then s.voice_id else null end,
    'voice_name', s.voice_name);
end $$;

revoke execute on function public.practicigo_set_voice(text, text) from public, anon;
revoke execute on function public.practicigo_clear_voice() from public, anon;
grant execute on function public.practicigo_set_voice(text, text) to authenticated;
grant execute on function public.practicigo_clear_voice() to authenticated;

-- Audio bucket: anyone can play a caption; only signed-in members of a studio can write under that studio's folder.
insert into storage.buckets (id, name, public) values ('melodigo-audio', 'melodigo-audio', true) on conflict (id) do nothing;

drop policy if exists "melodigo audio: public read" on storage.objects;
create policy "melodigo audio: public read" on storage.objects for select using (bucket_id = 'melodigo-audio');
drop policy if exists "melodigo audio: members write" on storage.objects;
create policy "melodigo audio: members write" on storage.objects for insert to authenticated
  with check (bucket_id = 'melodigo-audio' and (storage.foldername(name))[1] = public.practicigo_my_studio()::text);
drop policy if exists "melodigo audio: members update" on storage.objects;
create policy "melodigo audio: members update" on storage.objects for update to authenticated
  using (bucket_id = 'melodigo-audio' and (storage.foldername(name))[1] = public.practicigo_my_studio()::text);
drop policy if exists "melodigo audio: members delete" on storage.objects;
create policy "melodigo audio: members delete" on storage.objects for delete to authenticated
  using (bucket_id = 'melodigo-audio' and (storage.foldername(name))[1] = public.practicigo_my_studio()::text);

commit;
