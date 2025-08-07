-- Auto-tagging system extended schema for HDFC Account Explorer
-- This extends the existing schema with tables for auto-tagging functionality

-- Table to store custom tagging rules created by users
CREATE TABLE IF NOT EXISTS public.tagging_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  pattern_type varchar(20) NOT NULL CHECK (pattern_type IN ('keyword', 'regex', 'merchant', 'upi', 'amount_range', 'category')),
  pattern_value text NOT NULL,
  tag_ids uuid[] NOT NULL, -- Array of tag IDs to apply when rule matches
  priority integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  confidence_score decimal(3,2) NOT NULL DEFAULT 0.75 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  match_count integer NOT NULL DEFAULT 0, -- Number of times this rule has been used
  last_used timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tagging_rules_pkey PRIMARY KEY (id),
  CONSTRAINT tagging_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT tagging_rules_name_user_unique UNIQUE (name, user_id)
);

-- Table to store auto-tagging suggestions and their outcomes
CREATE TABLE IF NOT EXISTS public.tag_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chq_ref_number text NOT NULL,
  suggested_tag_id uuid NOT NULL,
  confidence_score decimal(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  suggestion_reason text NOT NULL,
  matched_keywords text[],
  rule_id uuid, -- Reference to tagging_rule if suggestion came from custom rule
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'auto_applied')),
  applied_at timestamp with time zone,
  feedback_rating integer CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tag_suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT tag_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT tag_suggestions_tag_id_fkey FOREIGN KEY (suggested_tag_id) REFERENCES public.tags(id) ON DELETE CASCADE,
  CONSTRAINT tag_suggestions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.tagging_rules(id) ON DELETE SET NULL
);

-- Table to store bulk tagging operations and their results
CREATE TABLE IF NOT EXISTS public.bulk_tagging_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  operation_name text NOT NULL,
  operation_type varchar(20) NOT NULL CHECK (operation_type IN ('bulk_apply', 'bulk_remove', 'auto_suggestions')),
  total_transactions integer NOT NULL DEFAULT 0,
  processed_transactions integer NOT NULL DEFAULT 0,
  successful_transactions integer NOT NULL DEFAULT 0,
  failed_transactions integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  error_details jsonb,
  operation_data jsonb, -- Store operation-specific data (filters, rules, etc.)
  undo_data jsonb, -- Store information needed to undo the operation
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT bulk_tagging_operations_pkey PRIMARY KEY (id),
  CONSTRAINT bulk_tagging_operations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table to store user preferences for auto-tagging
CREATE TABLE IF NOT EXISTS public.auto_tagging_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  minimum_confidence_threshold decimal(3,2) NOT NULL DEFAULT 0.70 CHECK (minimum_confidence_threshold >= 0 AND minimum_confidence_threshold <= 1),
  auto_apply_high_confidence boolean NOT NULL DEFAULT false,
  high_confidence_threshold decimal(3,2) NOT NULL DEFAULT 0.90 CHECK (high_confidence_threshold >= 0 AND high_confidence_threshold <= 1),
  enable_learning boolean NOT NULL DEFAULT true,
  batch_size integer NOT NULL DEFAULT 50 CHECK (batch_size >= 1 AND batch_size <= 500),
  show_low_confidence_suggestions boolean NOT NULL DEFAULT true,
  enable_merchant_learning boolean NOT NULL DEFAULT true,
  enable_pattern_learning boolean NOT NULL DEFAULT true,
  notification_preferences jsonb DEFAULT '{"suggestion_ready": true, "bulk_complete": true, "accuracy_reports": false}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT auto_tagging_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT auto_tagging_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT auto_tagging_preferences_user_id_unique UNIQUE (user_id)
);

-- Table to store learned patterns from user behavior
CREATE TABLE IF NOT EXISTS public.learned_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pattern_type varchar(20) NOT NULL CHECK (pattern_type IN ('merchant', 'narration', 'upi_domain', 'amount_range', 'time_pattern')),
  pattern_value text NOT NULL,
  associated_tag_ids uuid[] NOT NULL,
  confidence_score decimal(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count integer NOT NULL DEFAULT 1,
  success_rate decimal(3,2) NOT NULL DEFAULT 1.00 CHECK (success_rate >= 0 AND success_rate <= 1),
  last_used timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT learned_patterns_pkey PRIMARY KEY (id),
  CONSTRAINT learned_patterns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT learned_patterns_unique UNIQUE (user_id, pattern_type, pattern_value)
);

-- Table to track tagging analytics and metrics
CREATE TABLE IF NOT EXISTS public.tagging_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  total_suggestions_generated integer NOT NULL DEFAULT 0,
  suggestions_accepted integer NOT NULL DEFAULT 0,
  suggestions_rejected integer NOT NULL DEFAULT 0,
  suggestions_auto_applied integer NOT NULL DEFAULT 0,
  average_confidence_score decimal(4,3),
  transactions_tagged integer NOT NULL DEFAULT 0,
  bulk_operations_performed integer NOT NULL DEFAULT 0,
  rules_created integer NOT NULL DEFAULT 0,
  patterns_learned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tagging_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT tagging_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT tagging_analytics_user_date_unique UNIQUE (user_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tagging_rules_user_id ON public.tagging_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_tagging_rules_active ON public.tagging_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tagging_rules_priority ON public.tagging_rules(priority DESC);

CREATE INDEX IF NOT EXISTS idx_tag_suggestions_user_id ON public.tag_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_chq_ref ON public.tag_suggestions(chq_ref_number);
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_status ON public.tag_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_created_at ON public.tag_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_confidence ON public.tag_suggestions(confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_user_id ON public.bulk_tagging_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON public.bulk_tagging_operations(status);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_created_at ON public.bulk_tagging_operations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_user_id ON public.learned_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_type ON public.learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_confidence ON public.learned_patterns(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_usage ON public.learned_patterns(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_tagging_analytics_user_id ON public.tagging_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_tagging_analytics_date ON public.tagging_analytics(date DESC);

-- Create functions for common operations

-- Function to find orphaned tags (tags with no transaction associations)
CREATE OR REPLACE FUNCTION find_orphaned_tags()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
AS $$
  SELECT t.id, t.name
  FROM public.tags t
  LEFT JOIN public.transaction_tags tt ON t.id = tt.tag_id
  WHERE tt.tag_id IS NULL;
$$;

-- Function to update tagging analytics
CREATE OR REPLACE FUNCTION update_tagging_analytics(
  p_user_id uuid,
  p_suggestions_generated integer DEFAULT 0,
  p_suggestions_accepted integer DEFAULT 0,
  p_suggestions_rejected integer DEFAULT 0,
  p_suggestions_auto_applied integer DEFAULT 0,
  p_transactions_tagged integer DEFAULT 0,
  p_bulk_operations integer DEFAULT 0,
  p_rules_created integer DEFAULT 0,
  p_patterns_learned integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_date date := CURRENT_DATE;
BEGIN
  INSERT INTO public.tagging_analytics (
    user_id, date,
    total_suggestions_generated, suggestions_accepted, suggestions_rejected,
    suggestions_auto_applied, transactions_tagged, bulk_operations_performed,
    rules_created, patterns_learned
  )
  VALUES (
    p_user_id, today_date,
    p_suggestions_generated, p_suggestions_accepted, p_suggestions_rejected,
    p_suggestions_auto_applied, p_transactions_tagged, p_bulk_operations,
    p_rules_created, p_patterns_learned
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_suggestions_generated = tagging_analytics.total_suggestions_generated + p_suggestions_generated,
    suggestions_accepted = tagging_analytics.suggestions_accepted + p_suggestions_accepted,
    suggestions_rejected = tagging_analytics.suggestions_rejected + p_suggestions_rejected,
    suggestions_auto_applied = tagging_analytics.suggestions_auto_applied + p_suggestions_auto_applied,
    transactions_tagged = tagging_analytics.transactions_tagged + p_transactions_tagged,
    bulk_operations_performed = tagging_analytics.bulk_operations_performed + p_bulk_operations,
    rules_created = tagging_analytics.rules_created + p_rules_created,
    patterns_learned = tagging_analytics.patterns_learned + p_patterns_learned,
    updated_at = timezone('utc'::text, now());
END;
$$;

-- Function to get tagging completion percentage for a user
CREATE OR REPLACE FUNCTION get_tagging_completion_rate(p_user_id uuid)
RETURNS decimal(5,2)
LANGUAGE sql
AS $$
  WITH total_transactions AS (
    SELECT COUNT(DISTINCT chq_ref_number) as total
    FROM (
      SELECT unnest(transactions::json) ->> 'chqRefNumber' as chq_ref_number
      FROM public.statements
      WHERE user_id = p_user_id
    ) t
    WHERE chq_ref_number IS NOT NULL
  ),
  tagged_transactions AS (
    SELECT COUNT(DISTINCT tt.chq_ref_number) as tagged
    FROM public.transaction_tags tt
    JOIN public.tags t ON tt.tag_id = t.id
    WHERE EXISTS (
      SELECT 1 FROM public.statements s
      WHERE s.user_id = p_user_id
      AND s.transactions::text LIKE '%' || tt.chq_ref_number || '%'
    )
  )
  SELECT
    CASE
      WHEN total_transactions.total = 0 THEN 0.00
      ELSE ROUND((tagged_transactions.tagged::decimal / total_transactions.total::decimal) * 100, 2)
    END as completion_rate
  FROM total_transactions, tagged_transactions;
$$;

-- Function to clean up old suggestions (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_suggestions()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.tag_suggestions
    WHERE created_at < (NOW() - INTERVAL '30 days')
    AND status IN ('rejected', 'accepted')
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Set up Row Level Security (RLS) policies
ALTER TABLE public.tagging_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_tagging_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_tagging_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagging_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for tagging_rules
CREATE POLICY "Users can view their own tagging rules" ON public.tagging_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tagging rules" ON public.tagging_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tagging rules" ON public.tagging_rules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tagging rules" ON public.tagging_rules
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for tag_suggestions
CREATE POLICY "Users can view their own tag suggestions" ON public.tag_suggestions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tag suggestions" ON public.tag_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tag suggestions" ON public.tag_suggestions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for bulk_tagging_operations
CREATE POLICY "Users can view their own bulk operations" ON public.bulk_tagging_operations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bulk operations" ON public.bulk_tagging_operations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bulk operations" ON public.bulk_tagging_operations
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for auto_tagging_preferences
CREATE POLICY "Users can view their own preferences" ON public.auto_tagging_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON public.auto_tagging_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.auto_tagging_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for learned_patterns
CREATE POLICY "Users can view their own learned patterns" ON public.learned_patterns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own learned patterns" ON public.learned_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own learned patterns" ON public.learned_patterns
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for tagging_analytics
CREATE POLICY "Users can view their own analytics" ON public.tagging_analytics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own analytics" ON public.tagging_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own analytics" ON public.tagging_analytics
  FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers to automatically update updated_at columns
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Apply the trigger to all relevant tables
CREATE TRIGGER set_updated_at_tagging_rules
  BEFORE UPDATE ON public.tagging_rules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_tag_suggestions
  BEFORE UPDATE ON public.tag_suggestions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_auto_tagging_preferences
  BEFORE UPDATE ON public.auto_tagging_preferences
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_learned_patterns
  BEFORE UPDATE ON public.learned_patterns
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_tagging_analytics
  BEFORE UPDATE ON public.tagging_analytics
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Insert default preferences for existing users (optional migration)
-- INSERT INTO public.auto_tagging_preferences (user_id)
-- SELECT id FROM auth.users
-- WHERE id NOT IN (SELECT user_id FROM public.auto_tagging_preferences)
-- ON CONFLICT (user_id) DO NOTHING;