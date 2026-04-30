// In-app notification feed: deriva dai dati esistenti
// — promemoria follow-up (usa follow_up_at calcolato dal DB tramite trigger)
// — colloqui imminenti con anticipo notify_days_before
// — corsi imminenti con anticipo notify_days_before
import { differenceInCalendarDays, parseISO, isValid } from "date-fns";

/**
 * Parse robusto di date in formato ISO YYYY-MM-DD (o ISO completo).
 * Ritorna null per input mancanti, formato errato o date impossibili.
 * NON usa `new Date(string)` su stringhe ambigue.
 */
function safeParseISODate(input: string | null | undefined): Date | null {
  if (!input || typeof input !== "string") return null;
  // YYYY-MM-DD
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = parseISO(input.length === 10 ? input : input.slice(0, 10));
  if (!isValid(dt)) return null;
  // Catch rollover (es. 31 feb → 3 marzo)
  if (dt.getUTCDate() !== d || dt.getUTCMonth() + 1 !== mo || dt.getUTCFullYear() !== y) return null;
  return dt;
}

export type NotificationKind = "follow_up" | "interview" | "course";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  date: string; // ISO
  daysFromNow: number; // negative = past
  route: string;
  urgent: boolean;
}

interface AppRow {
  id: string;
  company: string | null;
  agency: string | null;
  role: string;
  applied_at: string;
  follow_up_at?: string | null;
  follow_up_days?: number | null;
  status: string;
  archived_at?: string | null;
}
interface InterviewRow {
  id: string;
  company: string;
  role: string | null;
  scheduled_at: string;
  outcome: string;
  notify_days_before?: number | null;
}
interface CourseRow {
  id: string;
  name: string;
  provider: string | null;
  start_date: string | null;
  enrollment_deadline: string | null;
  status: string;
  notify_days_before?: number | null;
}

export function buildNotifications(
  apps: AppRow[],
  interviews: InterviewRow[],
  courses: CourseRow[]
): AppNotification[] {
  const today = new Date();
  const out: AppNotification[] = [];

  for (const a of apps) {
    if (a.archived_at) continue; // Archiviate → niente promemoria
    if (!["in_attesa", "da_valutare"].includes(a.status)) continue; // Solo stati attivi

    // Validazione applied_at: deve esistere, essere ISO valido, non nel futuro
    const applied = safeParseISODate(a.applied_at);
    if (!applied) continue;
    if (applied.getTime() > today.getTime()) continue; // Date nel futuro → ignora

    // Calcolo target follow-up
    const days_cfg = a.follow_up_days ?? 30;
    const fromDb = a.follow_up_at ? safeParseISODate(a.follow_up_at) : null;
    const target = fromDb ?? new Date(applied.getTime() + days_cfg * 86400000);

    // Quanti giorni sono passati dall'applied_at
    const elapsedSinceApplied = differenceInCalendarDays(today, applied);
    // Safety cap: se i giorni dall'applied superano 120, dato sospetto → non mostrare
    if (elapsedSinceApplied > 120) continue;

    const days = differenceInCalendarDays(target, today);
    if (days <= 0) {
      const elapsed = -days;
      // Safety cap anche sul ritardo follow-up
      if (elapsed > 120) continue;
      out.push({
        id: `app-${a.id}`,
        kind: "follow_up",
        title: elapsed === 0 ? "Follow-up oggi" : `Follow-up scaduto da ${elapsed}gg`,
        subtitle: `${a.company || a.agency || "—"} • ${a.role}`,
        date: a.follow_up_at ?? a.applied_at,
        daysFromNow: days,
        route: `/applications/${a.id}`,
        urgent: elapsed >= 7,
      });
    }
  }

  for (const i of interviews) {
    if (i.outcome !== "in_attesa") continue;
    const sched = parseISO(i.scheduled_at);
    const days = differenceInCalendarDays(sched, today);
    const anticipo = i.notify_days_before ?? 1;
    if (days <= anticipo && days >= -1) {
      out.push({
        id: `intv-${i.id}`,
        kind: "interview",
        title: days <= 0 ? "Colloquio oggi" : days === 1 ? "Colloquio domani" : `Colloquio fra ${days}gg`,
        subtitle: `${i.company}${i.role ? ` • ${i.role}` : ""}`,
        date: i.scheduled_at,
        daysFromNow: days,
        route: `/interviews?focus=${i.id}`,
        urgent: days <= 1,
      });
    }
  }

  for (const c of courses) {
    if (["completato", "rifiutato"].includes(c.status)) continue;
    const anticipo = c.notify_days_before ?? 1;
    if (c.enrollment_deadline && ["interessato", "iscritto"].includes(c.status)) {
      const dl = parseISO(c.enrollment_deadline);
      const days = differenceInCalendarDays(dl, today);
      if (days <= anticipo + 6 && days >= 0) {
        out.push({
          id: `course-dl-${c.id}`,
          kind: "course",
          title: days === 0 ? "Iscrizione corso scade oggi" : `Iscrizione fra ${days}gg`,
          subtitle: `${c.name}${c.provider ? ` • ${c.provider}` : ""}`,
          date: c.enrollment_deadline,
          daysFromNow: days,
          route: `/courses?focus=${c.id}`,
          urgent: days <= 2,
        });
      }
    }
    if (c.start_date) {
      const sd = parseISO(c.start_date);
      const days = differenceInCalendarDays(sd, today);
      if (days <= anticipo && days >= 0) {
        out.push({
          id: `course-start-${c.id}`,
          kind: "course",
          title: days === 0 ? "Corso inizia oggi" : days === 1 ? "Corso inizia domani" : `Corso inizia fra ${days}gg`,
          subtitle: `${c.name}${c.provider ? ` • ${c.provider}` : ""}`,
          date: c.start_date,
          daysFromNow: days,
          route: `/courses?focus=${c.id}`,
          urgent: days <= 1,
        });
      }
    }
  }

  return out.sort((a, b) => a.daysFromNow - b.daysFromNow);
}

// ============= Web Push (best-effort) =============
const PUSH_PREF_KEY = "push.enabled";
const PUSH_LAST_SHOWN = "push.lastShown";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function pushPermission(): NotificationPermission {
  if (!pushSupported()) return "denied";
  return Notification.permission;
}

export function pushEnabled(): boolean {
  return pushSupported() && Notification.permission === "granted" && localStorage.getItem(PUSH_PREF_KEY) === "1";
}

export async function enablePush(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm === "granted") localStorage.setItem(PUSH_PREF_KEY, "1");
  return perm;
}

export function disablePush() {
  localStorage.setItem(PUSH_PREF_KEY, "0");
}

/** Mostra notifica nativa solo se l'utente l'ha esplicitamente abilitata e non è già stata mostrata di recente. */
export function showLocalNotification(n: AppNotification) {
  if (!pushEnabled()) return;
  try {
    const shownMap: Record<string, number> = JSON.parse(localStorage.getItem(PUSH_LAST_SHOWN) || "{}");
    const last = shownMap[n.id] || 0;
    // throttle: max una notifica per item ogni 6 ore
    if (Date.now() - last < 6 * 3600_000) return;
    const notif = new Notification(n.title, {
      body: n.subtitle,
      tag: n.id,
      icon: "/favicon.ico",
    });
    notif.onclick = () => {
      window.focus();
      window.location.href = n.route;
      notif.close();
    };
    shownMap[n.id] = Date.now();
    localStorage.setItem(PUSH_LAST_SHOWN, JSON.stringify(shownMap));
  } catch {
    // ignore
  }
}

/** True se la PWA gira in modalità standalone (Home iOS / installata Android). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS
  // @ts-ignore
  if (window.navigator.standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}
