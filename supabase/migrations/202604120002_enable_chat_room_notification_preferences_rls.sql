alter table public.chat_room_notification_preferences enable row level security;

create policy "select_own_chat_room_notification_preferences"
  on public.chat_room_notification_preferences
  for select
  using (
    exists (
      select 1
      from public."Profiles" p
      where p.id = chat_room_notification_preferences.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy "insert_own_chat_room_notification_preferences"
  on public.chat_room_notification_preferences
  for insert
  with check (
    exists (
      select 1
      from public."Profiles" p
      where p.id = chat_room_notification_preferences.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy "update_own_chat_room_notification_preferences"
  on public.chat_room_notification_preferences
  for update
  using (
    exists (
      select 1
      from public."Profiles" p
      where p.id = chat_room_notification_preferences.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy "delete_own_chat_room_notification_preferences"
  on public.chat_room_notification_preferences
  for delete
  using (
    exists (
      select 1
      from public."Profiles" p
      where p.id = chat_room_notification_preferences.profile_id
        and p.user_id = auth.uid()
    )
  );
