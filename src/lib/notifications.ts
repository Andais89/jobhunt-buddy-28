// In-app notification feed: deriva dai dati esistenti
// — promemoria follow-up dopo X giorni dall'invio (default 30)
// — colloqui imminenti con anticipo notify_days_before
// — corsi imminenti con anticipo notify_days_before
import { differenceInCalendarDays, parseISO } from "date-fns";

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
  follow_up_days?: number | null;
  status: string;
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
    if (!["in_attesa", "da_valutare"].includes(a.status)) continue;
    const days = a.follow_up_days ?? 30;
    const applied = parseISO(a.applied_at);
    const elapsed = differenceInCalendarDays(today, applied);
    if (elapsed >= days) {
      out.push({
        id: `app-${a.id}`,
        kind: "follow_up",
        title: `Promemoria follow-up`,
        subtitle: `${a.company || a.agency || "—"} • ${a.role}`,
        date: a.applied_at,
        daysFromNow: -elapsed,
        route: `/applications/${a.id}`,
        urgent: elapsed >= days + 7,
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
    // Notifica scadenza iscrizione
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
    // Notifica inizio corso
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

// Web Push permission helper (best-effort, no backend SW required)
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export function showLocalNotification(n: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const notif = new Notification(n.title, { body: n.subtitle, tag: n.id });
    notif.onclick = () => {
      window.focus();
      window.location.href = n.route;
      notif.close();
    };
  } catch {
    // ignore
  }
}
