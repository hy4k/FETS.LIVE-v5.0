-- Quick Access global sharing.
-- Personal entries remain user-owned. Mithun can mark selected entries as shared
-- so every authenticated user can see/copy them.

alter table public.quick_access_items
  add column if not exists is_global boolean not null default false;

create index if not exists idx_quick_access_global_client
  on public.quick_access_items (is_global, client_slug)
  where is_global = true;

drop policy if exists "quick_access_select" on public.quick_access_items;
create policy "quick_access_select" on public.quick_access_items
  for select to authenticated
  using (
    is_global = true
    or owner_id in (select id from public.staff_profiles where user_id = auth.uid())
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  );

drop policy if exists "quick_access_insert" on public.quick_access_items;
create policy "quick_access_insert" on public.quick_access_items
  for insert to authenticated
  with check (
    owner_id in (select id from public.staff_profiles where user_id = auth.uid())
    and (
      is_global = false
      or exists (
        select 1
        from public.staff_profiles sp
        where sp.user_id = auth.uid()
          and sp.role = 'super_admin'
          and lower(sp.email) = 'mithun@fets.in'
      )
    )
  );

drop policy if exists "quick_access_update" on public.quick_access_items;
create policy "quick_access_update" on public.quick_access_items
  for update to authenticated
  using (
    (is_global = false and owner_id in (select id from public.staff_profiles where user_id = auth.uid()))
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  )
  with check (
    (
      owner_id in (select id from public.staff_profiles where user_id = auth.uid())
      and is_global = false
    )
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  );

drop policy if exists "quick_access_delete" on public.quick_access_items;
create policy "quick_access_delete" on public.quick_access_items
  for delete to authenticated
  using (
    (is_global = false and owner_id in (select id from public.staff_profiles where user_id = auth.uid()))
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  );

comment on column public.quick_access_items.is_global is
  'When true, the entry is shared with all users. Only Mithun super admin can create/update/delete global entries.';
