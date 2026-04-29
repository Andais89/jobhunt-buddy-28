-- Applications: nuovi campi
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS hours_week TEXT,
  ADD COLUMN IF NOT EXISTS salary_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS salary_period TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_days INTEGER NOT NULL DEFAULT 30;

-- Courses: end_date, enrollment_date, notify_days_before
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS enrollment_date DATE,
  ADD COLUMN IF NOT EXISTS notify_days_before INTEGER NOT NULL DEFAULT 1;

-- Interviews: notify_days_before
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS notify_days_before INTEGER NOT NULL DEFAULT 1;