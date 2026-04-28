import { useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Application } from "@/lib/types";

export default function Reports() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);

  useEffect(() => { document.title = "Report — Regia Carriera"; }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("applications").select("*");
      if (active && data) setApps(data as Application[]);
    };
    load();

    const channel = supabase
      .channel(`apps-reports-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${user.id}` },
        () => { load(); }
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [user]);

  const total = apps.length;
  const replied = apps.filter(a => ["colloquio", "positiva", "negativa"].includes(a.status)).length;
  const positive = apps.filter(a => a.status === "positiva").length;
  const replyRate = total ? Math.round((replied / total) * 100) : 0;
  const successRate = total ? Math.round((positive / total) * 100) : 0;

  const topCompanies = useMemo(() => {
    const map = new Map<string, number>();
    apps.forEach(a => {
      const name = (a.company?.trim() || a.agency?.trim() || "—");
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [apps]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    apps.forEach(a => {
      const key = format(startOfMonth(parseISO(a.applied_at)), "yyyy-MM");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const arr = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    const max = Math.max(1, ...arr.map(([, v]) => v));
    return { arr, max };
  }, [apps]);

  return (
    <MobileShell title="Report" subtitle="Andamento">
      <div className="px-6 space-y-8">
        {/* KPI */}
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Inviate" value={total} />
          <Stat label="Risposte" value={replied} sub={`${replyRate}%`} />
          <Stat label="Positive" value={positive} sub={`${successRate}%`} accent />
          <Stat label="Senza risposta" value={total - replied} />
        </section>

        {/* Monthly bars */}
        <section>
          <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-4 border-b border-linen pb-2">
            Andamento Mensile
          </h3>
          {monthly.arr.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun dato.</p>
          ) : (
            <div className="space-y-3">
              {monthly.arr.map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-editorial text-muted-foreground w-12 shrink-0">
                    {format(parseISO(k + "-01"), "MMM yy", { locale: it })}
                  </span>
                  <div className="flex-1 h-6 bg-secondary relative">
                    <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${(v / monthly.max) * 100}%` }} />
                  </div>
                  <span className="text-xs tabular-nums w-6 text-right">{v}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top companies */}
        <section>
          <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-4 border-b border-linen pb-2">
            Aziende più frequenti
          </h3>
          {topCompanies.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun dato.</p>
          ) : (
            <ul className="space-y-2">
              {topCompanies.map(([name, count]) => (
                <li key={name} className="flex justify-between items-baseline border-b border-linen pb-2">
                  <span className="text-sm">{name}</span>
                  <span className="font-serif text-xl tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </MobileShell>
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
