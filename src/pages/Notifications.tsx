import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import {
  buildNotifications, AppNotification,
  snoozeNotification, markNotificationDone,
} from "@/lib/notifications";
import { Application } from "@/lib/types";
import { Bell, Check, Clock, ChevronRight, Archive as ArchiveIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CourseLite { id: string; name: string; provider: string | null; start_date: string | null; enrollment_deadline: string | null; status: string; notify_days_before?: number | null; }
interface InterviewLite { id: string; company: string; role: string | null; scheduled_at: string; outcome: string; notify_days_before?: number | null; }

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<InterviewLite[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Notifiche — Regia Carriera"; }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const [a, i, c] = await Promise.all([
        supabase.from("applications").select("*").is("archived_at", null),
        supabase.from("interviews").select("id,company,role,scheduled_at,outcome,notify_days_before"),
        supabase.from("courses").select("id,name,provider,start_date,enrollment_deadline,status,notify_days_before"),
      ]);
      if (!active) return;
      if (a.data) setApps(a.data as Application[]);
      if (i.data) setInterviews(i.data as InterviewLite[]);
      if (c.data) setCourses(c.data as CourseLite[]);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [user]);

  const all = useMemo(
    () => buildNotifications(apps as any, interviews as any, courses as any),
    [apps, interviews, courses, tick]
  );

  const today = all.filter(n => n.daysFromNow <= 0 && n.daysFromNow >= -0.5 || n.daysFromNow === 0);
  const overdue = all.filter(n => n.daysFromNow < 0);
  const upcoming = all.filter(n => n.daysFromNow > 0);
  // de-dup today vs overdue (today should only contain ===0)
  const todayList = all.filter(n => n.daysFromNow === 0);
  const overdueList = overdue;

  const archive = async (appId: string) => {
    const { error } = await supabase.from("applications")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", appId);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Archiviata" });
      setApps(prev => prev.filter(a => a.id !== appId));
    }
  };

  const handleSnooze = (id: string) => {
    snoozeNotification(id, 1);
    toast({ title: "Rimandato", description: "Tornerà domani." });
    setTick(t => t + 1);
  };
  const handleDone = (id: string) => {
    markNotificationDone(id);
    toast({ title: "Segnato come fatto" });
    setTick(t => t + 1);
  };

  const Section = ({ title, items, tone }: { title: string; items: AppNotification[]; tone?: "danger" }) => (
    items.length === 0 ? null : (
      <section className="px-6 mt-6">
        <h3 className={`text-[10px] uppercase tracking-editorial font-semibold mb-3 border-b border-linen pb-2 ${tone === "danger" ? "text-destructive" : "text-muted-foreground"}`}>
          {title} ({items.length})
        </h3>
        <ul className="space-y-2">
          {items.map(n => {
            const dt = parseISO(n.date);
            const dateLabel = isValid(dt) ? format(dt, "dd MMM", { locale: it }) : "";
            const isVeryOld = n.kind === "follow_up" && n.age === "old";
            return (
              <li key={n.id} className={`rounded-2xl border p-4 ${
                n.urgent ? "border-destructive/30 bg-destructive/5" : "border-linen bg-card"
              }`}>
                <button onClick={() => navigate(n.route)} className="w-full text-left flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {isVeryOld && (
                        <span className="text-[9px] uppercase tracking-editorial font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">vecchio</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.subtitle}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{dateLabel}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                </button>
                <div className="flex gap-2 mt-3 pt-3 border-t border-linen">
                  <button onClick={() => handleDone(n.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-[11px] uppercase tracking-editorial font-semibold">
                    <Check className="h-3 w-3" /> Fatto
                  </button>
                  <button onClick={() => handleSnooze(n.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-[11px] uppercase tracking-editorial font-semibold">
                    <Clock className="h-3 w-3" /> Rimanda
                  </button>
                  {isVeryOld && (
                    <button onClick={() => archive(n.entityId)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/15 text-destructive text-[11px] uppercase tracking-editorial font-semibold">
                      <ArchiveIcon className="h-3 w-3" /> Archivia
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    )
  );

  return (
    <MobileShell title="Notifiche" subtitle="Promemoria attivi">
      {loading ? (
        <p className="px-6 text-xs text-muted-foreground">Caricamento…</p>
      ) : all.length === 0 ? (
        <div className="px-6 text-center py-20">
          <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.4} />
          <p className="font-serif text-xl mb-1">Tutto in regola.</p>
          <p className="text-xs text-muted-foreground">Nessun promemoria attivo.</p>
        </div>
      ) : (
        <>
          <Section title="Oggi" items={todayList} />
          <Section title="Scaduti" items={overdueList} tone="danger" />
          <Section title="Prossimi giorni" items={upcoming} />
        </>
      )}
    </MobileShell>
  );
}
