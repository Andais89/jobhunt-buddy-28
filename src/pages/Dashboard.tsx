import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays, parseISO, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Application, AppStatus, STATUS_LABEL } from "@/lib/types";
import { AlertCircle, ArrowRight } from "lucide-react";

const KPIS: { key: AppStatus | "totale"; label: string; emphasis?: "accent" | "muted" }[] = [
  { key: "totale", label: "Totali" },
  { key: "in_attesa", label: "In Attesa" },
  { key: "colloquio", label: "Colloqui", emphasis: "accent" },
  { key: "da_valutare", label: "Da Valutare" },
  { key: "positiva", label: "Positive", emphasis: "accent" },
  { key: "negativa", label: "Negative", emphasis: "muted" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard — Regia Carriera";
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("applied_at", { ascending: false });
      if (!active) return;
      if (!error && data) setApps(data as Application[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`apps-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setApps((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Application;
              if (prev.some(a => a.id === row.id)) return prev;
              return [row, ...prev].sort((a, b) => (a.applied_at < b.applied_at ? 1 : -1));
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Application;
              return prev.map(a => (a.id === row.id ? row : a));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as Application;
              return prev.filter(a => a.id !== row.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { totale: apps.length };
    for (const s of ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"] as AppStatus[]) {
      c[s] = apps.filter(a => a.status === s).length;
    }
    return c;
  }, [apps]);

  const stale = useMemo(() => {
    return apps.filter(a => a.status === "in_attesa" && differenceInDays(new Date(), parseISO(a.applied_at)) >= 10);
  }, [apps]);

  const recent = apps.slice(0, 4);

  const todaySubtitle = format(new Date(), "MMM yyyy").toUpperCase();

  return (
    <MobileShell title="Regia Carriera" subtitle={todaySubtitle}>
      {/* KPI grid */}
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

      {/* Reminder banner */}
      {stale.length > 0 && (
        <section className="px-6 mt-8">
          <button
            onClick={() => navigate("/applications?status=in_attesa")}
            className="w-full text-left shadow-paper border border-linen bg-card p-5 hover:bg-secondary/40 transition rounded-2xl"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-foreground/20 text-[9px] uppercase tracking-editorial font-semibold">
                <AlertCircle className="h-3 w-3" /> Promemoria
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-lg font-semibold leading-snug">
              {stale.length === 1
                ? "1 candidatura senza risposta da oltre 10 giorni"
                : `${stale.length} candidature senza risposta da oltre 10 giorni`}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Considera un follow-up.</p>
          </button>
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
