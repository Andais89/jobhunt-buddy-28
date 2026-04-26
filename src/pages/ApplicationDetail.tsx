import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import { Application, AppStatus, AppPriority, STATUS_LABEL, PRIORITY_LABEL, SOURCES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Sparkles, Camera, Loader2 } from "lucide-react";

const STATUSES: AppStatus[] = ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"];
const PRIORITIES: AppPriority[] = ["bassa", "media", "alta"];

type Form = Partial<Application>;

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === "new";
  const [form, setForm] = useState<Form>({
    company: "", agency: "", role: "", status: "in_attesa", priority: "media",
    applied_at: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = isNew ? "Nuova candidatura" : "Modifica candidatura";
    if (isNew || !id) return;
    (async () => {
      const { data, error } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast({ title: "Non trovata", variant: "destructive" }); navigate("/applications"); return; }
      setForm(data as Application);
    })();
  }, [id, isNew, navigate]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }));

  const importLink = async () => {
    if (!form.job_url) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-job", { body: { url: form.job_url } });
      if (error) throw error;
      setForm(p => ({
        ...p,
        company: data.company ?? p.company,
        role: data.role ?? p.role,
        location: data.location ?? p.location,
        contract_type: data.contract_type ?? p.contract_type,
        salary: data.salary ?? p.salary,
        source: data.source ?? p.source,
      }));
      toast({ title: "Dati importati" });
    } catch (e: any) {
      toast({ title: "Import non riuscito", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const importImage = async (file: File) => {
    setImporting(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("import-job", { body: { image: b64 } });
      if (error) throw error;
      setForm(p => ({
        ...p,
        company: data.company ?? p.company,
        role: data.role ?? p.role,
        location: data.location ?? p.location,
        contract_type: data.contract_type ?? p.contract_type,
        salary: data.salary ?? p.salary,
        source: data.source ?? p.source ?? "Screenshot",
      }));
      toast({ title: "Screenshot letto" });
    } catch (e: any) {
      toast({ title: "OCR non riuscito", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const save = async () => {
    if (!user || !form.company?.trim() || !form.role?.trim()) {
      toast({ title: "Mancano dati", description: "Azienda e ruolo richiesti.", variant: "destructive" }); return;
    }
    setBusy(true);
    const payload = {
      user_id: user.id,
      company: form.company!.trim(),
      role: form.role!.trim(),
      location: form.location || null,
      applied_at: form.applied_at || new Date().toISOString().slice(0, 10),
      source: form.source || null,
      job_url: form.job_url || null,
      contract_type: form.contract_type || null,
      salary: form.salary || null,
      status: (form.status || "in_attesa") as AppStatus,
      notes: form.notes || null,
      priority: (form.priority || "media") as AppPriority,
      follow_up_at: form.follow_up_at || null,
    };
    const { error } = isNew
      ? await supabase.from("applications").insert(payload)
      : await supabase.from("applications").update(payload).eq("id", id!);
    setBusy(false);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salvata" });
    navigate("/applications");
  };

  const remove = async () => {
    if (!id || isNew) return;
    if (!confirm("Eliminare questa candidatura?")) return;
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Eliminata" });
    navigate("/applications");
  };

  return (
    <MobileShell
      title={isNew ? "Nuova" : "Dettaglio"}
      subtitle={isNew ? "Candidatura" : (form.company ?? "")}
      action={
        <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
      }
    >
      <div className="px-6 space-y-5">
        {/* Import block */}
        <div className="border border-linen bg-card p-4 space-y-3 rounded-2xl">
          <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground">Import smart</p>
          <div className="flex gap-2">
            <Input
              placeholder="https:// link annuncio"
              value={form.job_url ?? ""}
              onChange={(e) => set("job_url", e.target.value)}
              className="rounded-none"
            />
            <Button type="button" variant="outline" onClick={importLink} disabled={importing || !form.job_url} className="rounded-none shrink-0">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="w-full rounded-none">
            <Camera className="h-4 w-4 mr-2" /> {importing ? "Lettura…" : "Carica screenshot (OCR)"}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = "";
          }} />
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Field label="Azienda *">
            <Input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} className="rounded-none" />
          </Field>
          <Field label="Ruolo *">
            <Input value={form.role ?? ""} onChange={(e) => set("role", e.target.value)} className="rounded-none" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Località">
              <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} className="rounded-none" />
            </Field>
            <Field label="Data">
              <Input type="date" value={form.applied_at ?? ""} onChange={(e) => set("applied_at", e.target.value)} className="rounded-none" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fonte">
              <Select value={form.source ?? ""} onValueChange={(v) => set("source", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Contratto">
              <Input value={form.contract_type ?? ""} onChange={(e) => set("contract_type", e.target.value)} className="rounded-xl" placeholder="Es. tempo indet." />
            </Field>
          </div>
          <Field label="Stipendio (se presente)">
            <Input value={form.salary ?? ""} onChange={(e) => set("salary", e.target.value)} className="rounded-xl" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stato">
              <Select value={form.status ?? "in_attesa"} onValueChange={(v) => set("status", v as AppStatus)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Priorità">
              <Select value={form.priority ?? "media"} onValueChange={(v) => set("priority", v as AppPriority)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Reminder follow-up">
            <Input type="date" value={form.follow_up_at ?? ""} onChange={(e) => set("follow_up_at", e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="Note personali">
            <Textarea rows={4} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className="rounded-xl resize-none" />
          </Field>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={busy} className="flex-1 rounded-xl h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
          </Button>
          {!isNew && (
            <Button onClick={remove} variant="outline" className="rounded-xl h-11 border-destructive/30 text-destructive hover:bg-destructive/5">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-editorial">{label}</Label>
      {children}
    </div>
  );
}
