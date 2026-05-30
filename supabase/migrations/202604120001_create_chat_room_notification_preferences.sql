-- Per-profile, per-room email mute preferences for chat notifications

create table if not exists public.chat_room_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public."Profiles"(id) on delete cascade,
  room_id uuid not null,
  email_muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_room_notification_preferences_profile_room_key unique (profile_id, room_id)
);

create index if not exists idx_chat_room_notification_preferences_profile_id
  on public.chat_room_notification_preferences (profile_id);

create index if not exists idx_chat_room_notification_preferences_room_id
  on public.chat_room_notification_preferences (room_id);

create index if not exists idx_chat_room_notification_preferences_profile_room
  on public.chat_room_notification_preferences (profile_id, room_id);

create or replace function public.handle_chat_room_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_room_notification_preferences_set_updated_at on public.chat_room_notification_preferences;

create trigger chat_room_notification_preferences_set_updated_at
  before update on public.chat_room_notification_preferences
  for each row
  execute procedure public.handle_chat_room_notification_preferences_updated_at();
