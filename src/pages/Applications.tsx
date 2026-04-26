import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Application, AppStatus, STATUS_LABEL } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

const ALL_STATUSES: AppStatus[] = ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"];

export default function Applications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (params.get("status") as AppStatus | null);
  const [items, setItems] = useState<Application[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Candidature — Regia Carriera"; }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("applied_at", { ascending: false });
    if (!error && data) setItems(data as Application[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    let r = items;
    if (filter) r = r.filter(i => i.status === filter);
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(i =>
        i.company.toLowerCase().includes(t) ||
        i.role.toLowerCase().includes(t) ||
        (i.location ?? "").toLowerCase().includes(t)
      );
    }
    // priority sort: alta first
    const w = { alta: 0, media: 1, bassa: 2 } as const;
    return [...r].sort((a, b) => w[a.priority] - w[b.priority]);
  }, [items, filter, q]);

  const updateStatus = async (id: string, status: AppStatus) => {
    const prev = items;
    setItems(items.map(i => i.id === id ? { ...i, status } : i));
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) { setItems(prev); toast({ title: "Errore", description: error.message, variant: "destructive" }); }
  };

  return (
    <MobileShell title="Candidature" subtitle={`${filtered.length} di ${items.length}`}>
      <div className="px-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca azienda, ruolo, città"
            className="pl-10 rounded-xl border-linen bg-card"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-6 px-6 pb-1">
          <button
            onClick={() => setParams({})}
            className={`shrink-0 px-4 py-1.5 border text-[10px] uppercase tracking-editorial font-semibold transition rounded-full ${
              !filter ? "bg-foreground text-background border-foreground" : "bg-paper text-foreground border-linen"
            }`}
          >
            Tutte
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setParams({ status: s })}
              className={`shrink-0 px-4 py-1.5 border text-[10px] uppercase tracking-editorial font-semibold transition rounded-full ${
                filter === s ? "bg-foreground text-background border-foreground" : "bg-paper text-foreground border-linen"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
          {filter && (
            <button onClick={() => setParams({})} className="shrink-0 p-1.5 text-muted-foreground rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Caricamento…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-serif text-xl mb-1">Nessuna candidatura.</p>
            <p className="text-xs text-muted-foreground">Tocca + in basso a destra.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map(a => (
              <li key={a.id} className="bg-card border border-linen rounded-2xl p-4 shadow-soft">
                <div className="flex gap-3 items-start">
                  <button
                    onClick={() => navigate(`/applications/${a.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{a.company}</p>
                      {a.priority === "alta" && (
                        <span className="text-[9px] uppercase tracking-editorial font-bold text-accent shrink-0">★ Alta</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{a.role}{a.location ? ` • ${a.location}` : ""}</p>
                    {a.notes && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 italic">"{a.notes}"</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={a.status} />
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(a.applied_at), "dd MMM")}</span>
                      {a.source && <span className="text-[10px] text-muted-foreground">• {a.source}</span>}
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="shrink-0 px-2.5 py-1.5 text-[10px] uppercase tracking-editorial border border-linen hover:bg-secondary rounded-xl">
                      Stato
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      {ALL_STATUSES.map(s => (
                        <DropdownMenuItem key={s} onClick={() => updateStatus(a.id, s)}>
                          {STATUS_LABEL[s]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
