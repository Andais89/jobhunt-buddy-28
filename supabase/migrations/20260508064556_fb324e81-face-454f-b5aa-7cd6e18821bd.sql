
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS interviewer_name text,
  ADD COLUMN IF NOT EXISTS interviewer_linkedin text,
  ADD COLUMN IF NOT EXISTS reminder_1d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS reminder_1d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_select_push ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_insert_push ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_update_push ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY own_delete_push ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions(user_id);
