-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- This table is used to store users of the application
CREATE TABLE public.statement_groups (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  first_date timestamp with time zone NOT NULL,
  last_date timestamp with time zone NOT NULL,
  merged_summary jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT statement_groups_pkey PRIMARY KEY (id),
  CONSTRAINT statement_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
-- This table is used to store individual statements, which are part of a statement group
CREATE TABLE public.statements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  summary jsonb NOT NULL,
  transactions ARRAY NOT NULL,
  group_id uuid,
  CONSTRAINT statements_pkey PRIMARY KEY (id),
  CONSTRAINT statements_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.statement_groups(id),
  CONSTRAINT statements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
-- This table is used to store super statements, which are a collection of transactions
CREATE TABLE public.super_statement (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transactions jsonb NOT NULL,
  first_date timestamp with time zone NOT NULL,
  last_date timestamp with time zone NOT NULL,
  summary jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT super_statement_pkey PRIMARY KEY (id),
  CONSTRAINT super_statement_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
-- This table is used to store tags for transactions
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
-- This table is used to associate tags with transactions
CREATE TABLE public.transaction_tags (
  chq_ref_number text NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT transaction_tags_pkey PRIMARY KEY (chq_ref_number, tag_id),
  CONSTRAINT transaction_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);