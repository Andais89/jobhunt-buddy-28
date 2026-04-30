import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Application, STATUS_LABEL } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Archive as ArchiveIcon, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Archive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Application[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Archivio — Regia Carriera"; }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
    if (data) setItems(data as Application[]);
    setLoading(false);

    // Auto-purge: elimina candidature archiviate da > 90 giorni
    const expired = (data as Application[] || []).filter(a => {
      if (!a.archived_at) return false;
      return differenceInCalendarDays(new Date(), parseISO(a.archived_at)) >= 90;
    });
    if (expired.length > 0) {
      await supabase.from("applications").delete().in("id", expired.map(e => e.id));
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`archive-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const t = q.toLowerCase();
    return items.filter(i =>
      (i.company ?? "").toLowerCase().includes(t) ||
      (i.agency ?? "").toLowerCase().includes(t) ||
      i.role.toLowerCase().includes(t)
    );
  }, [items, q]);

  const restore = async (a: Application) => {
    const { error } = await supabase.from("applications").update({ archived_at: null }).eq("id", a.id);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Ripristinata", description: a.company || a.agency || "" });
  };

  return (
    <MobileShell title="Archivio" subtitle={`${items.length} candidature`}>
      <div className="px-6 space-y-4">
        <div className="flex items-start gap-2 rounded-xl bg-foreground/[0.03] border border-linen px-3 py-2.5">
          <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Le candidature archiviate non generano promemoria. Vengono eliminate automaticamente dopo 90 giorni.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca nell'archivio"
            className="pl-10 rounded-xl border-linen bg-card"
          />
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Caricamento…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ArchiveIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" strokeWidth={1.2} />
            <p className="font-serif text-xl mb-1">Archivio vuoto.</p>
            <p className="text-xs text-muted-foreground">Sposta qui le candidature ferme da oltre un mese.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map(a => {
              const daysArchived = a.archived_at ? differenceInCalendarDays(new Date(), parseISO(a.archived_at)) : 0;
              const daysToDelete = 90 - daysArchived;
              return (
                <li key={a.id} className="bg-card border border-linen rounded-2xl p-4 shadow-soft opacity-90">
                  <div className="flex gap-3 items-start">
                    <button onClick={() => navigate(`/applications/${a.id}`)} className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-sm truncate">{a.company?.trim() || a.agency?.trim() || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.role}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-editorial font-semibold">{STATUS_LABEL[a.status]}</span>
                        {a.archived_at && (
                          <span className="text-[10px] text-muted-foreground">
                            • Archiviata {format(parseISO(a.archived_at), "dd MMM", { locale: it })}
                          </span>
                        )}
                        <span className={`text-[10px] ${daysToDelete <= 14 ? "text-destructive" : "text-muted-foreground"}`}>
                          • elim. fra {daysToDelete}gg
                        </span>
                      </div>
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restore(a)}
                      className="rounded-xl shrink-0 text-[10px] uppercase tracking-editorial"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Ripristina
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
