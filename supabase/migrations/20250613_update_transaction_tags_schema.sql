-- First, drop all policies that depend on user_id
DROP POLICY IF EXISTS "Users can view their own transaction tags" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can insert their own transaction tags" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can insert transaction tags if they own the transaction" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can delete their own transaction tags" ON public.transaction_tags;

-- Now we can safely remove the user_id column
ALTER TABLE public.transaction_tags DROP COLUMN IF EXISTS user_id;

-- Update indices
DROP INDEX IF EXISTS idx_transaction_tags_user_id;

-- Drop any existing global policies before creating new ones
DROP POLICY IF EXISTS "Enable read access to transaction tags" ON public.transaction_tags;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.transaction_tags;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.transaction_tags;

-- Create new RLS policies for global tag system
CREATE POLICY "Enable read access to transaction tags"
  ON public.transaction_tags FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON public.transaction_tags FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
  ON public.transaction_tags FOR DELETE
  USING (auth.role() = 'authenticated');

-- Make sure RLS is enabled
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;