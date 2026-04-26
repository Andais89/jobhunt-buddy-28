-- Enums
CREATE TYPE public.application_status AS ENUM ('da_valutare','in_attesa','colloquio','positiva','negativa');
CREATE TYPE public.application_priority AS ENUM ('bassa','media','alta');
CREATE TYPE public.interview_outcome AS ENUM ('in_attesa','positivo','negativo','no_show');
CREATE TYPE public.course_status AS ENUM ('interessato','iscritto','in_corso','completato','rifiutato');

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT,
  applied_at DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  job_url TEXT,
  contract_type TEXT,
  salary TEXT,
  status public.application_status NOT NULL DEFAULT 'in_attesa',
  notes TEXT,
  priority public.application_priority NOT NULL DEFAULT 'media',
  follow_up_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_applications_user ON public.applications(user_id);
CREATE INDEX idx_applications_status ON public.applications(user_id, status);

-- Interviews
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  company TEXT NOT NULL,
  role TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  mode TEXT,
  outcome public.interview_outcome NOT NULL DEFAULT 'in_attesa',
  prep_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interviews_user ON public.interviews(user_id);

-- Courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT,
  start_date DATE,
  enrollment_deadline DATE,
  status public.course_status NOT NULL DEFAULT 'interessato',
  notes TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_courses_user ON public.courses(user_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select_apps" ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert_apps" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update_apps" ON public.applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete_apps" ON public.applications FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own_select_interviews" ON public.interviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert_interviews" ON public.interviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update_interviews" ON public.interviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete_interviews" ON public.interviews FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own_select_courses" ON public.courses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert_courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update_courses" ON public.courses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete_courses" ON public.courses FOR DELETE USING (auth.uid() = user_id);