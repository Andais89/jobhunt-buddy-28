import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Application, STATUS_LABEL } from "@/lib/types";
import { ChevronRight, X } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

interface CourseRow {
  id: string;
  name: string;
  provider: string | null;
  start_date: string | null;
  status: string;
}

export default function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [openCompany, setOpenCompany] = useState<string | null>(null);

  const [interviewDates, setInterviewDates] = useState<string[]>([]);

  useEffect(() => { document.title = "Report — Regia Carriera"; }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const [a, c, i] = await Promise.all([
        supabase.from("applications").select("*").order("applied_at", { ascending: false }),
        supabase.from("courses").select("id,name,provider,start_date,status"),
        supabase.from("interviews").select("scheduled_at"),
      ]);
      if (!active) return;
      if (a.data) setApps(a.data as Application[]);
      if (c.data) setCourses(c.data as CourseRow[]);
      if (i.data) setInterviewDates((i.data as { scheduled_at: string }[]).map(r => r.scheduled_at.slice(0, 10)));
    };
    load();

    const channel = supabase
      .channel(`reports-realtime-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "courses", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "interviews", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [user]);

  const total = apps.length;
  const replied = apps.filter(a => ["colloquio", "positiva", "negativa"].includes(a.status)).length;
  const positive = apps.filter(a => a.status === "positiva").length;
  const replyRate = total ? Math.round((replied / total) * 100) : 0;

  // Daily timeline (last 30 distinct days)
  const dailyApps = useMemo(() => {
    const map = new Map<string, Application[]>();
    apps.forEach(a => {
      const key = a.applied_at;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 30);
  }, [apps]);

  const maxPerDay = useMemo(() => Math.max(1, ...dailyApps.map(([, list]) => list.length)), [dailyApps]);

  // Trend data: last 30 calendar days, applications + interviews per day
  const trendData = useMemo(() => {
    const days: { date: string; label: string; Candidature: number; Colloqui: number }[] = [];
    const appCounts = new Map<string, number>();
    apps.forEach(a => appCounts.set(a.applied_at, (appCounts.get(a.applied_at) || 0) + 1));
    const intCounts = new Map<string, number>();
    interviewDates.forEach(d => intCounts.set(d, (intCounts.get(d) || 0) + 1));

    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        label: format(d, "dd/MM", { locale: it }),
        Candidature: appCounts.get(key) || 0,
        Colloqui: intCounts.get(key) || 0,
      });
    }
    return days;
  }, [apps, interviewDates]);

  const dailyAppsBarData = useMemo(
    () => trendData.map(d => ({ label: d.label, Inviate: d.Candidature })),
    [trendData],
  );

  const topCompanies = useMemo(() => {
    const map = new Map<string, Application[]>();
    apps.forEach(a => {
      const name = (a.company?.trim() || a.agency?.trim() || "—");
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(a);
    });
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);
  }, [apps]);

  // Course timeline (by start_date, fallback enrollment date)
  const dailyCourses = useMemo(() => {
    const map = new Map<string, CourseRow[]>();
    courses.forEach(c => {
      const key = c.start_date;
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10);
  }, [courses]);

  const dayItems = openDay ? apps.filter(a => a.applied_at === openDay) : [];
  const companyItems = openCompany
    ? apps.filter(a => (a.company?.trim() || a.agency?.trim() || "—") === openCompany)
    : [];

  return (
    <MobileShell title="Report" subtitle="Andamento">
      <div className="px-6 space-y-8">
        {/* KPI essenziali */}
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Inviate" value={total} />
          <Stat label="Risposte" value={replied} sub={`${replyRate}%`} />
          <Stat label="Positive" value={positive} accent />
          <Stat label="In attesa" value={total - replied} />
        </section>

        {/* Trend candidature vs colloqui (line chart) */}
        <section>
          <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-4 border-b border-linen pb-2">
            Trend — Candidature & Colloqui (ultimi 30 giorni)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Candidature" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Colloqui" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Andamento candidature per giorno */}
        <section>
          <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-4 border-b border-linen pb-2">
            Candidature per giorno
          </h3>
          {dailyApps.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun dato.</p>
          ) : (
            <ul className="space-y-1">
              {dailyApps.map(([date, list]) => (
                <li key={date}>
                  <button
                    onClick={() => setOpenDay(date)}
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-secondary/40 transition text-left"
                  >
                    <span className="font-serif text-base tabular-nums w-16 shrink-0">
                      {format(parseISO(date), "dd MMM", { locale: it })}
                    </span>
                    <div className="flex-1 h-1.5 bg-linen rounded-full overflow-hidden">
                      <div className="h-full bg-foreground rounded-full" style={{ width: `${(list.length / maxPerDay) * 100}%` }} />
                    </div>
                    <span className="text-sm tabular-nums font-medium w-8 text-right">{list.length}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Aziende più frequenti */}
        <section>
          <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-4 border-b border-linen pb-2">
            Aziende & agenzie più frequenti
          </h3>
          {topCompanies.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun dato.</p>
          ) : (
            <ul className="space-y-1">
              {topCompanies.map(([name, list]) => (
                <li key={name}>
                  <button
                    onClick={() => setOpenCompany(name)}
                    className="w-full flex justify-between items-center py-2.5 px-3 rounded-xl hover:bg-secondary/40 transition text-left"
                  >
                    <span className="text-sm truncate">{name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-serif text-lg tabular-nums">{list.length}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Report Corsi (separato) */}
        <section>
          <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-4 border-b border-linen pb-2">
            Corsi — inizio
          </h3>
          {dailyCourses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun corso con data inizio.</p>
          ) : (
            <ul className="space-y-2">
              {dailyCourses.map(([date, list]) => (
                <li
                  key={date}
                  onClick={() => navigate("/courses")}
                  className="flex justify-between items-center py-2.5 px-3 rounded-xl hover:bg-secondary/40 transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-serif text-base tabular-nums">{format(parseISO(date), "dd MMM yyyy", { locale: it })}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{list.map(c => c.name).join(" • ")}</p>
                  </div>
                  <span className="font-serif text-lg tabular-nums shrink-0 ml-3">{list.length}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Day drilldown */}
      {openDay && (
        <DrillDown
          title={format(parseISO(openDay), "EEEE dd MMMM yyyy", { locale: it })}
          subtitle={`${dayItems.length} candidature`}
          onClose={() => setOpenDay(null)}
        >
          <ul className="space-y-3">
            {dayItems.map(a => (
              <li key={a.id}>
                <button
                  onClick={() => { setOpenDay(null); navigate(`/applications/${a.id}`); }}
                  className="w-full text-left bg-card border border-linen rounded-2xl p-4 shadow-soft"
                >
                  <p className="font-medium text-sm">{a.company?.trim() || a.agency?.trim() || "—"}</p>
                  {a.agency && a.company && <p className="text-[11px] text-muted-foreground italic">tramite {a.agency}</p>}
                  <p className="text-xs text-muted-foreground">{a.role}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] uppercase tracking-editorial font-semibold">{STATUS_LABEL[a.status]}</span>
                    {a.follow_up_at && <span className="text-[10px] text-muted-foreground">• follow-up {format(parseISO(a.follow_up_at), "dd MMM")}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </DrillDown>
      )}

      {openCompany && (
        <DrillDown
          title={openCompany}
          subtitle={`${companyItems.length} candidature`}
          onClose={() => setOpenCompany(null)}
        >
          <ul className="space-y-3">
            {companyItems.map(a => (
              <li key={a.id}>
                <button
                  onClick={() => { setOpenCompany(null); navigate(`/applications/${a.id}`); }}
                  className="w-full text-left bg-card border border-linen rounded-2xl p-4 shadow-soft"
                >
                  <p className="font-medium text-sm">{a.role}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(a.applied_at), "dd MMM yyyy", { locale: it })}{a.location ? ` • ${a.location}` : ""}</p>
                  <span className="inline-block mt-2 text-[10px] uppercase tracking-editorial font-semibold">{STATUS_LABEL[a.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        </DrillDown>
      )}
    </MobileShell>
  );
}

function DrillDown({ title, subtitle, onClose, children }: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-center" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-paper border-x border-linen flex flex-col mt-12 rounded-t-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-linen">
          <div className="min-w-0">
            <h2 className="font-serif text-xl font-semibold truncate">{title}</h2>
            <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 pb-12">{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-linen rounded-2xl p-5 shadow-soft">
      <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-3">{label}</p>
      <p className={`text-3xl font-serif tabular-nums ${accent ? "text-accent" : ""}`}>{String(value).padStart(2, "0")}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
