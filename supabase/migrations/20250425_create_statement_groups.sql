-- Create statement_groups table
create table public.statement_groups (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  first_date timestamp with time zone not null,
  last_date timestamp with time zone not null,
  merged_summary jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.statement_groups enable row level security;

create policy "Users can view their own statement groups"
  on public.statement_groups for select
  using (auth.uid() = user_id);

create policy "Users can insert their own statement groups"
  on public.statement_groups for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own statement groups"
  on public.statement_groups for update
  using (auth.uid() = user_id);

-- Add group_id to statements table
alter table public.statements 
  add column group_id uuid references public.statement_groups(id) on delete cascade;

-- Create index for date range queries
create index idx_statement_groups_date_range 
  on public.statement_groups using btree (first_date, last_date);

-- Create index for user_id lookups
create index idx_statement_groups_user_id
  on public.statement_groups(user_id);

-- Create trigger to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger update_statement_groups_updated_at
  before update on public.statement_groups
  for each row
  execute function update_updated_at_column();

-- Update statements RLS policies to include group access
create policy "Users can view statements in their groups"
  on public.statements for select
  using (
    auth.uid() = user_id or
    auth.uid() in (
      select user_id 
      from public.statement_groups 
      where id = statements.group_id
    )
  );
