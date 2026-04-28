import { supabase } from "@/integrations/supabase/client";
import { Application, AppStatus, InterviewOutcome, CourseStatus } from "@/lib/types";

export type EntityKind = "application" | "interview" | "course";

interface Interview {
  id: string;
  user_id: string;
  application_id: string | null;
  company: string;
  role: string | null;
  scheduled_at: string;
  mode: string | null;
  outcome: InterviewOutcome;
  prep_notes: string | null;
}

interface Course {
  id: string;
  user_id: string;
  name: string;
  provider: string | null;
  start_date: string | null;
  enrollment_deadline: string | null;
  status: CourseStatus;
  notes: string | null;
  url: string | null;
}

/**
 * Convert an existing entity into a different kind, preserving as much data as possible.
 * Creates the new record, then deletes the original. Returns the new record's id and kind.
 */
export async function convertEntity(
  fromKind: EntityKind,
  fromId: string,
  toKind: EntityKind,
  userId: string
): Promise<{ id: string; kind: EntityKind }> {
  if (fromKind === toKind) return { id: fromId, kind: fromKind };

  // 1) Load source
  let source: any = null;
  if (fromKind === "application") {
    const { data, error } = await supabase.from("applications").select("*").eq("id", fromId).maybeSingle();
    if (error || !data) throw new Error("Sorgente non trovata");
    source = data as Application;
  } else if (fromKind === "interview") {
    const { data, error } = await supabase.from("interviews").select("*").eq("id", fromId).maybeSingle();
    if (error || !data) throw new Error("Sorgente non trovata");
    source = data as Interview;
  } else {
    const { data, error } = await supabase.from("courses").select("*").eq("id", fromId).maybeSingle();
    if (error || !data) throw new Error("Sorgente non trovata");
    source = data as Course;
  }

  // 2) Build target payload
  let newId = "";
  if (toKind === "application") {
    const payload =
      fromKind === "interview"
        ? {
            user_id: userId,
            company: source.company || null,
            agency: null,
            role: source.role || "Da definire",
            applied_at: source.scheduled_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            status: "colloquio" as AppStatus,
            notes: source.prep_notes || null,
            priority: "media" as const,
          }
        : {
            user_id: userId,
            company: source.provider || source.name || null,
            agency: null,
            role: source.name || "Corso",
            applied_at: source.start_date || new Date().toISOString().slice(0, 10),
            status: "in_attesa" as AppStatus,
            notes: source.notes || null,
            job_url: source.url || null,
            priority: "media" as const,
          };
    const { data, error } = await supabase.from("applications").insert(payload).select("id").single();
    if (error) throw error;
    newId = data.id;
  } else if (toKind === "interview") {
    const payload =
      fromKind === "application"
        ? {
            user_id: userId,
            company: (source.company || source.agency || "Azienda") as string,
            role: source.role || null,
            scheduled_at: new Date(source.applied_at + "T10:00:00").toISOString(),
            mode: source.work_mode || "Video",
            outcome: "in_attesa" as InterviewOutcome,
            prep_notes: source.notes || null,
          }
        : {
            user_id: userId,
            company: (source.provider || source.name) as string,
            role: source.name || null,
            scheduled_at: new Date((source.start_date || new Date().toISOString().slice(0, 10)) + "T10:00:00").toISOString(),
            mode: "Video",
            outcome: "in_attesa" as InterviewOutcome,
            prep_notes: source.notes || null,
          };
    const { data, error } = await supabase.from("interviews").insert(payload).select("id").single();
    if (error) throw error;
    newId = data.id;
  } else {
    const payload =
      fromKind === "application"
        ? {
            user_id: userId,
            name: source.role || source.company || "Corso",
            provider: source.company || source.agency || null,
            start_date: source.applied_at || null,
            enrollment_deadline: source.follow_up_at || null,
            status: "interessato" as CourseStatus,
            notes: source.notes || source.job_summary || null,
            url: source.job_url || null,
          }
        : {
            user_id: userId,
            name: source.role || source.company || "Corso",
            provider: source.company || null,
            start_date: source.scheduled_at?.slice(0, 10) || null,
            enrollment_deadline: null,
            status: "interessato" as CourseStatus,
            notes: source.prep_notes || null,
            url: null,
          };
    const { data, error } = await supabase.from("courses").insert(payload).select("id").single();
    if (error) throw error;
    newId = data.id;
  }

  // 3) Delete source
  const tbl = fromKind === "application" ? "applications" : fromKind === "interview" ? "interviews" : "courses";
  const { error: delErr } = await supabase.from(tbl).delete().eq("id", fromId);
  if (delErr) {
    // best-effort: keep going so we don't lose the new record
    console.warn("convertEntity: source delete failed", delErr);
  }

  return { id: newId, kind: toKind };
}

export function entityRoute(kind: EntityKind, id: string): string {
  if (kind === "application") return `/applications/${id}`;
  if (kind === "interview") return "/interviews";
  return "/courses";
}
