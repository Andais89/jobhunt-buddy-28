export type AppStatus = "da_valutare" | "in_attesa" | "colloquio" | "positiva" | "negativa";
export type AppPriority = "bassa" | "media" | "alta";
export type InterviewOutcome = "in_attesa" | "positivo" | "negativo" | "no_show";
export type CourseStatus = "interessato" | "iscritto" | "in_corso" | "completato" | "rifiutato";

export const STATUS_LABEL: Record<AppStatus, string> = {
  da_valutare: "Da valutare",
  in_attesa: "In attesa",
  colloquio: "Colloquio",
  positiva: "Positiva",
  negativa: "Negativa",
};

export const STATUS_TONE: Record<AppStatus, string> = {
  da_valutare: "bg-muted text-foreground border-border",
  in_attesa: "bg-secondary text-foreground border-border",
  colloquio: "bg-accent/15 text-accent border-accent/30",
  positiva: "bg-success/15 text-success border-success/30",
  negativa: "bg-destructive/10 text-destructive border-destructive/30",
};

export const PRIORITY_LABEL: Record<AppPriority, string> = {
  bassa: "Bassa", media: "Media", alta: "Alta",
};

export const SOURCES = ["Indeed", "LinkedIn", "Adecco", "InfoJobs", "GiGroup", "Sito aziendale", "Referral", "Altro"];

// Dropdown options
export const WORK_MODES = ["Remoto", "Ibrido", "In sede"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const CONTRACT_TYPES = [
  "Apprendistato",
  "Stage",
  "Tirocinio",
  "Tempo determinato",
  "Tempo indeterminato",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const HOURS_OPTIONS = ["20", "25", "30", "40"] as const;
export type HoursOption = (typeof HOURS_OPTIONS)[number];

export const SALARY_PERIODS = ["Annuale", "Mensile"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const NOTIFY_PRESETS = [
  { v: 1, l: "1 giorno prima" },
  { v: 3, l: "3 giorni prima" },
  { v: 7, l: "1 settimana prima" },
  { v: 14, l: "2 settimane prima" },
] as const;

export interface Application {
  id: string;
  user_id: string;
  company: string | null;
  agency: string | null;
  role: string;
  location: string | null;
  applied_at: string;
  job_summary: string | null;
  source: string | null;
  job_url: string | null;
  contract_type: string | null;
  salary: string | null;
  salary_amount: number | null;
  salary_period: string | null;
  hours_week: string | null;
  work_mode: string | null;
  seniority_level: string | null;
  benefits: string | null;
  contact_email: string | null;
  status: AppStatus;
  notes: string | null;
  priority: AppPriority;
  follow_up_at: string | null;
  follow_up_days: number;
  archived_at: string | null;
  match_score: number | null;
  gap_analysis: string[] | null;
  interviewer_name: string | null;
  interviewer_linkedin: string | null;
  interview_questions: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  cv_text: string | null;
  skills: string | null;
  experience_summary: string | null;
}
