-- Creates activity_logs table for Phase 5 activity logging

create extension if not exists pgcrypto;

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_type varchar(32) not null,
  actor_id uuid null,
  actor_label varchar(255) null,
  action_type varchar(255) not null,
  action_detail text null,
  status varchar(32) not null,
  metadata jsonb null
);

create index if not exists activity_logs_created_at_idx on activity_logs (created_at desc);
create index if not exists activity_logs_actor_type_idx on activity_logs (actor_type);
create index if not exists activity_logs_status_idx on activity_logs (status);
