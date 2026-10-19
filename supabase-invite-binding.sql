-- Bind each newly issued invitation to a specific login nickname.
-- Run in Supabase SQL Editor after the current DKVS schema is installed.
alter table public.dkvs_invites
  add column if not exists reserved_login_name text;

create or replace function public.dkvs_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
  uname text;
  pid text;
  invite_code_value text;
  invite_row uuid;
  invite_login_name text;
begin
  invite_code_value := trim(coalesce(new.raw_user_meta_data->>'invite_code', ''));
  uname := lower(trim(coalesce(new.raw_user_meta_data->>'login_name', '')));
  if invite_code_value = '' then
    raise exception 'Для реєстрації потрібен код-запрошення';
  end if;
  if uname = '' then
    raise exception 'Вкажіть Nickname для входу';
  end if;

  select code, reserved_login_name into invite_row, invite_login_name
  from public.dkvs_invites
  where code::text = invite_code_value and used_at is null
  for update;
  if not found then
    raise exception 'Код-запрошення невірний або вже використаний';
  end if;
  if invite_login_name is not null and lower(trim(invite_login_name)) <> uname then
    raise exception 'Цей код-запрошення закріплений за іншим Nickname';
  end if;

  update public.dkvs_invites
  set used_at = now(), used_by = new.id
  where code = invite_row;

  n := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1));
  pid := coalesce(new.raw_user_meta_data->>'player_id', '');
  insert into public.dkvs_profiles(user_id, login_name, auth_email, display_name, player_id, role, active)
    values (new.id, uname, new.email, n, pid, 'Співробітник', true);
  return new;
end;
$$;

drop function if exists public.dkvs_issue_invite();
create or replace function public.dkvs_issue_invite(p_login_name text)
returns text
language plpgsql
security definer
set search_path = public
as $invite$
declare
  new_code uuid;
  normalized_login text;
begin
  if public.dkvs_current_role() is distinct from 'Власник сайту' then
    raise exception 'Створювати коди-запрошення може лише власник сайту';
  end if;
  normalized_login := lower(trim(coalesce(p_login_name, '')));
  if normalized_login = '' or length(normalized_login) > 50 then
    raise exception 'Вкажіть Nickname для входу (до 50 символів)';
  end if;
  if exists (select 1 from public.dkvs_profiles where active = true and lower(login_name) = normalized_login) then
    raise exception 'Активний акаунт із таким Nickname уже існує';
  end if;
  insert into public.dkvs_invites(created_by, reserved_login_name)
  values (auth.uid(), normalized_login)
  returning code into new_code;
  return new_code::text;
end;
$invite$;
revoke all on function public.dkvs_issue_invite(text) from public, anon;
grant execute on function public.dkvs_issue_invite(text) to authenticated;
