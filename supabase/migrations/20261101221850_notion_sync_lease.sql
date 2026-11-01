-- A durable per-entry lease and creation checkpoint work across Vercel instances.
-- Unknown external-create outcomes stay pending instead of creating a duplicate.
create table public.notion_sync_state (
  entry_id uuid primary key references public.diary_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lease_id uuid,
  lease_until timestamptz not null default '-infinity',
  create_pending boolean not null default false,
  page_id text
);
create index notion_sync_state_user_id_idx on public.notion_sync_state(user_id);

alter table public.notion_sync_state enable row level security;
create policy "notion sync: own entry only" on public.notion_sync_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.diary_entries e
      where e.id = entry_id and e.user_id = (select auth.uid())
    )
  );
revoke all on public.notion_sync_state from anon;
grant select, insert, update, delete on public.notion_sync_state to authenticated;

create function public.acquire_notion_sync(p_entry_id uuid, p_lease_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v public.notion_sync_state%rowtype;
begin
  if p_lease_id is null or auth.uid() is null or not exists (
    select 1 from public.diary_entries e where e.id = p_entry_id and e.user_id = auth.uid()
  ) then
    raise exception 'Entry not found' using errcode = '42501';
  end if;
  insert into public.notion_sync_state as s (entry_id, user_id, lease_id, lease_until, page_id)
    select e.id, e.user_id, p_lease_id, clock_timestamp() + interval '120 seconds', e.notion_page_id
    from public.diary_entries e where e.id = p_entry_id and e.user_id = auth.uid()
  on conflict (entry_id) do update
    set lease_id = excluded.lease_id, lease_until = excluded.lease_until
    where s.user_id = auth.uid() and (s.lease_until <= clock_timestamp() or s.lease_id = p_lease_id)
  returning * into v;
  if not found then return jsonb_build_object('acquired', false); end if;
  return jsonb_build_object('acquired', true, 'pageId', v.page_id, 'createPending', v.create_pending);
end;
$$;

-- Every transition is fenced by lease_id. Finalization updates the entry and
-- checkpoint in the same transaction, so a lost response can be retried safely.
create function public.transition_notion_sync(
  p_entry_id uuid, p_lease_id uuid, p_action text, p_page_id text default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v public.notion_sync_state%rowtype;
begin
  select * into v from public.notion_sync_state s
    where s.entry_id = p_entry_id and s.user_id = auth.uid() and s.lease_id = p_lease_id
    for update;
  if not found or (p_action <> 'release' and v.lease_until <= clock_timestamp()) then
    raise exception 'Notion sync lease lost' using errcode = '40001';
  end if;

  if p_action = 'prepare_create' then
    if v.create_pending or v.page_id is not null then
      raise exception 'Notion creation requires recovery' using errcode = '55000';
    end if;
    v.create_pending := true;
  elsif p_action = 'checkpoint' then
    if not v.create_pending or p_page_id is null or
      (v.page_id is not null and v.page_id <> p_page_id) then
      raise exception 'Invalid Notion checkpoint' using errcode = '22023';
    end if;
    v.page_id := p_page_id;
  elsif p_action = 'finalize' then
    if p_page_id is null or v.page_id is distinct from p_page_id then
      raise exception 'Invalid Notion page' using errcode = '22023';
    end if;
    update public.diary_entries set notion_page_id = p_page_id, notion_synced_at = clock_timestamp()
      where id = p_entry_id and user_id = auth.uid();
    if not found then raise exception 'Entry not found' using errcode = '42501'; end if;
    v.create_pending := false;
  elsif p_action = 'discard' then
    if not v.create_pending or (v.page_id is not null and v.page_id is distinct from p_page_id) then
      raise exception 'Invalid Notion compensation' using errcode = '22023';
    end if;
    v.page_id := null;
    v.create_pending := false;
  elsif p_action not in ('renew', 'release') then
    raise exception 'Invalid Notion sync action' using errcode = '22023';
  end if;

  update public.notion_sync_state set
    page_id = v.page_id, create_pending = v.create_pending,
    lease_id = case when p_action = 'release' then null else p_lease_id end,
    lease_until = case when p_action = 'release' then '-infinity'::timestamptz
      else clock_timestamp() + interval '120 seconds' end
    where entry_id = p_entry_id and user_id = auth.uid();
  return jsonb_build_object('pageId', v.page_id, 'createPending', v.create_pending);
end;
$$;

revoke all on function public.acquire_notion_sync(uuid, uuid) from public, anon;
revoke all on function public.transition_notion_sync(uuid, uuid, text, text) from public, anon;
grant execute on function public.acquire_notion_sync(uuid, uuid) to authenticated;
grant execute on function public.transition_notion_sync(uuid, uuid, text, text) to authenticated;
