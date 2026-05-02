import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseISO, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Application, AppStatus, STATUS_LABEL } from "@/lib/types";
import { Bell, ChevronRight, ExternalLink } from "lucide-react";
import { MatchScoreBadge } from "@/components/MatchScoreBadge";
import { buildNotifications, AppNotification, showLocalNotification, pushEnabled } from "@/lib/notifications";

const KPIS: { key: AppStatus | "totale"; label: string; emphasis?: "accent" | "muted" }[] = [
  { key: "totale", label: "Totali" },
  { key: "in_attesa", label: "In Attesa" },
  { key: "da_valutare", label: "Da Valutare" },
  { key: "positiva", label: "Positive", emphasis: "accent" },
  { key: "negativa", label: "Negative", emphasis: "muted" },
];

interface CourseLite {
  id: string; name: string; provider: string | null;
  start_date: string | null; enrollment_deadline: string | null;
  status: string; notify_days_before?: number | null;
}
interface InterviewLite {
  id: string; company: string; role: string | null;
  scheduled_at: string; outcome: string; notify_days_before?: number | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<InterviewLite[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Dashboard — Regia Carriera"; }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const [a, i, c] = await Promise.all([
        supabase.from("applications").select("*").is("archived_at", null).order("applied_at", { ascending: false }),
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
    const channel = supabase
      .channel(`dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "interviews", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "courses", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { totale: apps.length };
    for (const s of ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"] as AppStatus[]) {
      c[s] = apps.filter(a => a.status === s).length;
    }
    return c;
  }, [apps]);

  const notifications: AppNotification[] = useMemo(
    () => buildNotifications(apps as any, interviews as any, courses as any),
    [apps, interviews, courses]
  );

  // Trigger native push for urgent items (only if user enabled it)
  useEffect(() => {
    if (!pushEnabled()) return;
    notifications.filter(n => n.urgent).forEach(showLocalNotification);
  }, [notifications]);

  const recent = apps.slice(0, 4);
  const todaySubtitle = format(new Date(), "MMM yyyy").toUpperCase();

  return (
    <MobileShell title="Regia Carriera" subtitle={todaySubtitle}>
      {/* KPI grid (no Colloqui card) */}
      <section className="px-6">
        <div className="grid grid-cols-2 gap-3">
          {KPIS.map(({ key, label, emphasis }) => {
            const value = counts[key] ?? 0;
            const target = key === "totale" ? "/applications" : `/applications?status=${key}`;
            return (
              <button
                key={key}
                onClick={() => navigate(target)}
                className="bg-card border border-linen rounded-2xl p-5 text-left hover:bg-secondary/40 transition-colors shadow-soft"
              >
                <span className="block text-[10px] uppercase tracking-editorial text-muted-foreground mb-3">{label}</span>
                <span className={`text-3xl font-serif tabular-nums ${emphasis === "accent" ? "text-accent" : ""}`}>
                  {String(value).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Notifiche / Promemoria */}
      {notifications.length > 0 && (
        <section className="px-6 mt-8">
          <div className="flex items-center justify-between mb-3 border-b border-linen pb-2">
            <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground flex items-center gap-2">
              <Bell className="h-3 w-3" /> Promemoria ({notifications.length})
            </h3>
            <button
              onClick={() => navigate("/notifications")}
              className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground hover:text-foreground"
            >
              Vedi tutti
            </button>
          </div>
          <ul className="space-y-2">
            {notifications.slice(0, 5).map(n => {
              const isOld = n.kind === "follow_up" && n.age === "old";
              return (
                <li key={n.id}>
                  <button
                    onClick={() => navigate(n.route)}
                    className={`w-full text-left p-4 rounded-2xl border transition flex items-center gap-3 ${
                      n.urgent ? "border-destructive/30 bg-destructive/5" : "border-linen bg-card hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {isOld && (
                          <span className="text-[9px] uppercase tracking-editorial font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">vecchio</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{n.subtitle}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Recent dossiers */}
      <section className="px-6 mt-10">
        <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-4 border-b border-linen pb-2">
          Ultime Candidature
        </h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">Caricamento…</p>
        ) : recent.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-serif text-xl mb-2">Nessuna candidatura.</p>
            <p className="text-xs text-muted-foreground">Tocca + per iniziare.</p>
          </div>
        ) : (
          <ul className="space-y-5">
            {recent.map(a => (
              <li key={a.id}>
                <button
                  onClick={() => navigate(`/applications/${a.id}`)}
                  className="w-full flex items-center justify-between text-left group"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-medium text-sm truncate">{a.company?.trim() || a.agency?.trim() || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.role}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-editorial font-semibold">{STATUS_LABEL[a.status]}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(a.applied_at), "dd MMM")}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MobileShell>
  );
}
