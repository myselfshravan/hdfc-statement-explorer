-- Create super_statement table to store all merged transactions
create table public.super_statement (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    transactions jsonb not null,
    first_date timestamp with time zone not null,
    last_date timestamp with time zone not null,
    summary jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes
create index idx_super_statement_user_id on public.super_statement(user_id);
create index idx_super_statement_date_range on public.super_statement using btree (first_date, last_date);

-- Add RLS policies
alter table public.super_statement enable row level security;

create policy "Users can view their own super statement"
  on public.super_statement for select
  using (auth.uid() = user_id);

create policy "Users can update their own super statement"
  on public.super_statement for update
  using (auth.uid() = user_id);

create policy "Users can insert their own super statement"
  on public.super_statement for insert
  with check (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
create trigger update_super_statement_updated_at
  before update on public.super_statement
  for each row
  execute function update_updated_at_column();
