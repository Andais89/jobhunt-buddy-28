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

export interface Application {
  id: string;
  user_id: string;
  company: string;
  agency: string | null;
  role: string;
  location: string | null;
  applied_at: string;
  source: string | null;
  job_url: string | null;
  contract_type: string | null;
  salary: string | null;
  status: AppStatus;
  notes: string | null;
  priority: AppPriority;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}
