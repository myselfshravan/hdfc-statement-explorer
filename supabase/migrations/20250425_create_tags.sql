-- Create tags table
create table public.tags (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    color text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    -- Add unique constraint on user_id and name combination
    unique(user_id, name)
);

-- Create transaction_tags table for many-to-many relationship
create table public.transaction_tags (
    transaction_id text not null,
    tag_id uuid references public.tags(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    -- Make transaction_id and tag_id combination unique
    primary key (transaction_id, tag_id)
);

-- Add indexes
create index idx_tags_user_id on public.tags(user_id);
create index idx_transaction_tags_transaction_id on public.transaction_tags(transaction_id);
create index idx_transaction_tags_tag_id on public.transaction_tags(tag_id);
create index idx_transaction_tags_user_id on public.transaction_tags(user_id);

-- Add RLS policies
alter table public.tags enable row level security;
alter table public.transaction_tags enable row level security;

-- Tags policies
create policy "Users can view their own tags"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tags"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tags"
  on public.tags for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tags"
  on public.tags for delete
  using (auth.uid() = user_id);

-- Transaction tags policies
create policy "Users can view their own transaction tags"
  on public.transaction_tags for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transaction tags"
  on public.transaction_tags for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own transaction tags"
  on public.transaction_tags for delete
  using (auth.uid() = user_id);

-- Add trigger to update updated_at on tags
create trigger update_tags_updated_at
  before update on public.tags
  for each row
  execute function update_updated_at_column();
