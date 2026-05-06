import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CourseStatus, NOTIFY_PRESETS } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowRightLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { convertEntity, entityRoute, EntityKind } from "@/lib/convertEntity";

interface Course {
  id: string;
  name: string;
  provider: string | null;
  start_date: string | null;
  end_date: string | null;
  enrollment_date: string | null;
  enrollment_deadline: string | null;
  notify_days_before: number;
  status: CourseStatus;
  notes: string | null;
  url: string | null;
}

const STATUSES: { v: CourseStatus; l: string }[] = [
  { v: "interessato", l: "Interessato" },
  { v: "iscritto", l: "Iscritto" },
  { v: "in_corso", l: "In corso" },
  { v: "completato", l: "Completato" },
  { v: "rifiutato", l: "Rifiutato" },
];

export default function Courses() {
  const { user } = useAuth();
  const [items, setItems] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => { document.title = "Corsi — Regia Carriera"; }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("courses").select("*").order("start_date", { ascending: false, nullsFirst: false });
    if (data) setItems(data as Course[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`courses-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "courses", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Deep-link focus
  useEffect(() => {
    const focus = params.get("focus");
    if (focus && items.length) {
      const item = items.find(i => i.id === focus);
      if (item) { setEditing(item); setOpen(true); setParams({}); }
    }
  }, [params, items, setParams]);

  return (
    <MobileShell title="Corsi" subtitle={`${items.length} totali`}
      action={<button onClick={() => { setEditing(null); setOpen(true); }} className="p-2 text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" /></button>}>
      <div className="px-6">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-serif text-xl mb-1">Nessun corso.</p>
            <p className="text-xs text-muted-foreground">Tocca + per aggiungerne uno.</p>
          </div>
        ) : (
          <ul className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
            {items.map(c => {
              const daysLeft = c.enrollment_deadline ? differenceInDays(parseISO(c.enrollment_deadline), new Date()) : null;
              const urgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
              return (
                <li key={c.id} className="bg-card border border-linen rounded-2xl p-4 shadow-soft">
                  <button onClick={() => { setEditing(c); setOpen(true); }} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        {c.provider && <p className="text-xs text-muted-foreground truncate">{c.provider}</p>}
                      </div>
                      <span className="text-[10px] uppercase tracking-editorial font-semibold shrink-0">
                        {STATUSES.find(s => s.v === c.status)?.l}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {c.start_date && <p className="text-[11px] text-muted-foreground">Inizio: {format(parseISO(c.start_date), "dd MMM yyyy")}</p>}
                      {c.end_date && <p className="text-[11px] text-muted-foreground">Fine: {format(parseISO(c.end_date), "dd MMM yyyy")}</p>}
                    </div>
                    {c.enrollment_deadline && (
                      <p className={`text-[11px] mt-1 ${urgent ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        Iscrizione entro {format(parseISO(c.enrollment_deadline), "dd MMM")}
                        {daysLeft !== null && daysLeft >= 0 && ` • ${daysLeft}gg`}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CourseDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { load(); setOpen(false); }} />
    </MobileShell>
  );
}

function CourseDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Course | null; onSaved: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<Course>>({});
  const [converting, setConverting] = useState(false);

  const convertTo = async (kind: EntityKind) => {
    if (!user || !editing) return;
    setConverting(true);
    try {
      const res = await convertEntity("course", editing.id, kind, user.id);
      toast({ title: kind === "application" ? "Spostato in Candidature" : "Spostato in Colloqui" });
      onOpenChange(false);
      onSaved();
      navigate(entityRoute(res.kind, res.id));
    } catch (e: any) {
      toast({ title: "Conversione non riuscita", description: e.message, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    if (open) setForm(editing ?? {
      name: "", provider: "", status: "interessato",
      enrollment_date: new Date().toISOString().slice(0, 10),
      notify_days_before: 1,
    });
  }, [open, editing]);

  const save = async () => {
    if (!user || !form.name?.trim()) { toast({ title: "Nome richiesto", variant: "destructive" }); return; }
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      provider: form.provider || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      enrollment_date: form.enrollment_date || null,
      enrollment_deadline: form.enrollment_deadline || null,
      notify_days_before: form.notify_days_before ?? 1,
      status: (form.status ?? "interessato") as CourseStatus,
      notes: form.notes || null,
      url: form.url || null,
    };
    const { error } = editing
      ? await supabase.from("courses").update(payload).eq("id", editing.id)
      : await supabase.from("courses").insert(payload);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm("Eliminare?")) return;
    await supabase.from("courses").delete().eq("id", editing.id);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] rounded-2xl border-linen max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif text-2xl">{editing ? "Corso" : "Nuovo corso"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <Field label="Nome corso *"><Input value={form.name ?? ""} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" /></Field>
          <Field label="Ente / Scuola"><Input value={form.provider ?? ""} onChange={(e) => setForm(p => ({ ...p, provider: e.target.value }))} className="rounded-xl" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Data inizio"><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm(p => ({ ...p, start_date: e.target.value }))} className="rounded-xl" /></Field>
            <Field label="Data fine"><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm(p => ({ ...p, end_date: e.target.value }))} className="rounded-xl" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Data iscrizione"><Input type="date" value={form.enrollment_date ?? ""} onChange={(e) => setForm(p => ({ ...p, enrollment_date: e.target.value }))} className="rounded-xl" /></Field>
            <Field label="Scadenza iscriz."><Input type="date" value={form.enrollment_deadline ?? ""} onChange={(e) => setForm(p => ({ ...p, enrollment_deadline: e.target.value }))} className="rounded-xl" /></Field>
          </div>
          <Field label="Stato">
            <Select value={form.status ?? "interessato"} onValueChange={(v) => setForm(p => ({ ...p, status: v as CourseStatus }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Notifica anticipo">
            <Select value={String(form.notify_days_before ?? 1)} onValueChange={(v) => setForm(p => ({ ...p, notify_days_before: Number(v) }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{NOTIFY_PRESETS.map(n => <SelectItem key={n.v} value={String(n.v)}>{n.l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Link"><Input value={form.url ?? ""} onChange={(e) => setForm(p => ({ ...p, url: e.target.value }))} className="rounded-xl" /></Field>
          <Field label="Note"><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} className="rounded-xl resize-none" /></Field>
          {editing && (
            <div className="border border-linen rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground">Sposta in</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={converting} onClick={() => convertTo("application")} className="flex-1 rounded-xl text-xs">Candidatura</Button>
                <Button type="button" variant="outline" size="sm" disabled={converting} onClick={() => convertTo("interview")} className="flex-1 rounded-xl text-xs">Colloquio</Button>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={save} className="flex-1 rounded-xl">Salva</Button>
            {editing && <Button variant="outline" onClick={remove} className="rounded-xl border-destructive/30 text-destructive"><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-editorial">{label}</Label>{children}</div>;
}
