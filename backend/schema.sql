-- Run this in your Supabase SQL Editor

create table if not exists queue_entries (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  status text not null default 'waiting', -- waiting, serving, completed, skipped, left, reset
  joined_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists queue_settings (
  id int primary key default 1,
  is_paused boolean not null default false,
  average_service_time_ms int not null default 300000,
  max_capacity int not null default 30
);

-- Insert the single settings row
insert into queue_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists service_history (
  id bigint generated always as identity primary key,
  service_time_ms int not null,
  served_at timestamptz not null default now()
);
