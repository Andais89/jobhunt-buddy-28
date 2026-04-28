import { useEffect, useState } from "react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InterviewOutcome } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Interview {
  id: string;
  company: string;
  role: string | null;
  scheduled_at: string;
  mode: string | null;
  outcome: InterviewOutcome;
  prep_notes: string | null;
}

const OUTCOMES: { v: InterviewOutcome; l: string }[] = [
  { v: "in_attesa", l: "In attesa" },
  { v: "positivo", l: "Positivo" },
  { v: "negativo", l: "Negativo" },
  { v: "no_show", l: "No show" },
];

export default function Interviews() {
  const { user } = useAuth();
  const [items, setItems] = useState<Interview[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);

  useEffect(() => { document.title = "Colloqui — Regia Carriera"; }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("interviews").select("*").order("scheduled_at", { ascending: true });
    if (data) setItems(data as Interview[]);
  };
  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`interviews-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interviews", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const now = new Date();
  const upcoming = items.filter(i => isAfter(parseISO(i.scheduled_at), now));
  const past = items.filter(i => isBefore(parseISO(i.scheduled_at), now));

  return (
    <MobileShell
      title="Colloqui"
      subtitle={`${upcoming.length} in arrivo`}
      action={
        <button onClick={() => { setEditing(null); setOpen(true); }} className="p-2 text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" />
        </button>
      }
    >
      <div className="px-6 space-y-8">
        <Section title="In arrivo" items={upcoming} onEdit={(i) => { setEditing(i); setOpen(true); }} reload={load} />
        <Section title="Passati" items={past} onEdit={(i) => { setEditing(i); setOpen(true); }} reload={load} muted />
      </div>

      <InterviewDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { load(); setOpen(false); }} />
    </MobileShell>
  );
}

function Section({ title, items, onEdit, reload, muted }: {
  title: string; items: Interview[]; onEdit: (i: Interview) => void; reload: () => void; muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-3 border-b border-linen pb-2">{title}</h3>
      <ul className={`space-y-3 ${muted ? "opacity-70" : ""}`}>
        {items.map(i => (
          <li key={i.id} className="bg-card border border-linen rounded-2xl p-4 shadow-soft">
            <button onClick={() => onEdit(i)} className="w-full text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{i.company}</p>
                  {i.role && <p className="text-xs text-muted-foreground truncate">{i.role}</p>}
                </div>
                <span className="text-[10px] uppercase tracking-editorial font-semibold shrink-0 text-accent">
                  {OUTCOMES.find(o => o.v === i.outcome)?.l}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {format(parseISO(i.scheduled_at), "EEE dd MMM • HH:mm")}{i.mode ? ` • ${i.mode}` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InterviewDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Interview | null; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<Interview>>({});

  useEffect(() => {
    if (open) {
      setForm(editing ?? {
        company: "", role: "", scheduled_at: new Date().toISOString().slice(0, 16),
        mode: "Video", outcome: "in_attesa", prep_notes: "",
      });
    }
  }, [open, editing]);

  const save = async () => {
    if (!user || !form.company?.trim() || !form.scheduled_at) {
      toast({ title: "Mancano dati", variant: "destructive" }); return;
    }
    const payload = {
      user_id: user.id,
      company: form.company.trim(),
      role: form.role || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      mode: form.mode || null,
      outcome: (form.outcome ?? "in_attesa") as InterviewOutcome,
      prep_notes: form.prep_notes || null,
    };
    const { error } = editing
      ? await supabase.from("interviews").update(payload).eq("id", editing.id)
      : await supabase.from("interviews").insert(payload);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salvato" });
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm("Eliminare?")) return;
    await supabase.from("interviews").delete().eq("id", editing.id);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] rounded-2xl border-linen">
        <DialogHeader><DialogTitle className="font-serif text-2xl">{editing ? "Colloquio" : "Nuovo colloquio"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-editorial">Azienda *</Label>
            <Input value={form.company ?? ""} onChange={(e) => setForm(p => ({ ...p, company: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-editorial">Posizione</Label>
            <Input value={form.role ?? ""} onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))} className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-editorial">Data e ora *</Label>
              <Input type="datetime-local" value={typeof form.scheduled_at === "string" ? form.scheduled_at.slice(0, 16) : ""}
                onChange={(e) => setForm(p => ({ ...p, scheduled_at: e.target.value }))} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-editorial">Modalità</Label>
              <Input value={form.mode ?? ""} onChange={(e) => setForm(p => ({ ...p, mode: e.target.value }))} className="rounded-xl" placeholder="Video / In sede" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-editorial">Esito</Label>
            <Select value={form.outcome ?? "in_attesa"} onValueChange={(v) => setForm(p => ({ ...p, outcome: v as InterviewOutcome }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{OUTCOMES.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-editorial">Note preparazione</Label>
            <Textarea rows={3} value={form.prep_notes ?? ""} onChange={(e) => setForm(p => ({ ...p, prep_notes: e.target.value }))} className="rounded-xl resize-none" /></div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} className="flex-1 rounded-xl">Salva</Button>
            {editing && <Button variant="outline" onClick={remove} className="rounded-xl border-destructive/30 text-destructive"><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
