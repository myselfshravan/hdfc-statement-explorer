-- First, remove the unique constraint on user_id and name combination
alter table public.tags drop constraint tags_user_id_name_key;

-- Add a new unique constraint on just the name since tags will be global
alter table public.tags add constraint tags_name_key unique (name);

-- Create a temporary table to store unique tag names and colors
create temporary table temp_tags as
select distinct on (lower(name)) 
  id,
  name,
  color,
  created_at,
  updated_at
from public.tags;

-- Ensure transaction_tags matches our code's use of chqRefNumber
alter table public.transaction_tags rename column transaction_id to chq_ref_number;

-- Drop existing foreign key constraints
alter table public.transaction_tags drop constraint transaction_tags_tag_id_fkey;
alter table public.transaction_tags drop constraint transaction_tags_pkey;

-- Drop the old tags table
drop table public.tags;

-- Create new tags table without user_id
create table public.tags (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    color text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert preserved tags into new table
insert into public.tags (id, name, color, created_at, updated_at)
select id, name, color, created_at, updated_at
from temp_tags;

-- Add back constraints
alter table public.transaction_tags
add constraint transaction_tags_tag_id_fkey
foreign key (tag_id) references public.tags(id) on delete cascade;

-- Make chq_ref_number and tag_id combination unique
alter table public.transaction_tags
add constraint transaction_tags_pkey primary key (chq_ref_number, tag_id);

-- Drop the temporary table
drop table temp_tags;

-- Update RLS policies for tags
drop policy if exists "Users can view their own tags" on public.tags;
drop policy if exists "Users can insert their own tags" on public.tags;
drop policy if exists "Users can update their own tags" on public.tags;
drop policy if exists "Users can delete their own tags" on public.tags;

-- New policies for global tags
create policy "Everyone can view tags"
  on public.tags for select
  using (true);

create policy "Only authenticated users can insert tags"
  on public.tags for insert
  with check (auth.role() = 'authenticated');

create policy "Only authenticated users can update tags"
  on public.tags for update
  using (auth.role() = 'authenticated');

-- No delete policy - tags are permanent once created

-- Update transaction_tags policies
drop policy if exists "Users can view their own transaction tags" on public.transaction_tags;
drop policy if exists "Users can insert their own transaction tags" on public.transaction_tags;
drop policy if exists "Users can delete their own transaction tags" on public.transaction_tags;

create policy "Users can view their own transaction tags"
  on public.transaction_tags for select
  using (auth.uid() = user_id);

create policy "Users can insert transaction tags if they own the transaction"
  on public.transaction_tags for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own transaction tags"
  on public.transaction_tags for delete
  using (auth.uid() = user_id);
