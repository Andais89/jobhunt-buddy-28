import { supabase } from "@/integrations/supabase/client";

export interface DuplicateMatch {
  id: string;
  company: string | null;
  agency: string | null;
  role: string;
  job_url: string | null;
  applied_at: string;
  reason: "url" | "company_role";
}

/**
 * Cerca candidature dell'utente con stesso URL o stessa coppia (azienda + ruolo).
 * Esclude `excludeId` (utile in modalità modifica).
 */
export async function findDuplicateApplication(opts: {
  userId: string;
  jobUrl?: string | null;
  company?: string | null;
  role?: string | null;
  excludeId?: string | null;
}): Promise<DuplicateMatch | null> {
  const { userId, jobUrl, company, role, excludeId } = opts;
  const url = jobUrl?.trim();
  const c = company?.trim().toLowerCase();
  const r = role?.trim().toLowerCase();

  // 1) URL match
  if (url) {
    const { data } = await supabase
      .from("applications")
      .select("id,company,agency,role,job_url,applied_at")
      .eq("user_id", userId)
      .eq("job_url", url)
      .limit(1);
    const hit = (data ?? []).find((d) => d.id !== excludeId);
    if (hit) return { ...hit, reason: "url" };
  }

  // 2) Company + role match (case-insensitive)
  if (c && r) {
    const { data } = await supabase
      .from("applications")
      .select("id,company,agency,role,job_url,applied_at")
      .eq("user_id", userId)
      .ilike("company", c)
      .ilike("role", r)
      .limit(5);
    const hit = (data ?? []).find((d) => d.id !== excludeId);
    if (hit) return { ...hit, reason: "company_role" };
  }
  return null;
}
