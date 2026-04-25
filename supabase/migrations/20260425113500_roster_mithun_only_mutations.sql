-- Roster mutation lockdown.
-- Everyone can continue reading roster data, but create/update/delete is Mithun only.

drop policy if exists "Auth users can edit roster" on public.roster_schedules;
drop policy if exists "Restricted insert for authorized staff" on public.roster_schedules;
drop policy if exists "Restricted update for authorized staff" on public.roster_schedules;
drop policy if exists "Restricted delete for authorized staff" on public.roster_schedules;

create policy "Roster insert Mithun only" on public.roster_schedules
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  );

create policy "Roster update Mithun only" on public.roster_schedules
  for update to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  )
  with check (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  );

create policy "Roster delete Mithun only" on public.roster_schedules
  for delete to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = auth.uid()
        and sp.role = 'super_admin'
        and lower(sp.email) = 'mithun@fets.in'
    )
  );
