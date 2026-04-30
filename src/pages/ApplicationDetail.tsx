import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileShell } from "@/components/MobileShell";
import {
  Application, AppStatus, AppPriority, STATUS_LABEL, PRIORITY_LABEL, SOURCES,
  WORK_MODES, CONTRACT_TYPES, HOURS_OPTIONS, SALARY_PERIODS,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Sparkles, Camera, Loader2, ArrowRightLeft, Archive as ArchiveIcon, RotateCcw } from "lucide-react";
import { convertEntity, entityRoute, EntityKind } from "@/lib/convertEntity";

const STATUSES: AppStatus[] = ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"];
const PRIORITIES: AppPriority[] = ["bassa", "media", "alta"];
const KIND_LABEL: Record<EntityKind, string> = {
  application: "Candidatura",
  interview: "Colloquio",
  course: "Corso",
};

type Form = Partial<Application>;

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === "new";
  const [form, setForm] = useState<Form>({
    company: "", agency: "", role: "", status: "in_attesa", priority: "media",
    applied_at: new Date().toISOString().slice(0, 10),
    follow_up_days: 30,
    salary_period: "Annuale",
  });
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [converting, setConverting] = useState<EntityKind | null>(null);
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

  const applyImport = (data: any) => {
    setForm(p => ({
      ...p,
      company: data.company ?? p.company,
      agency: data.agency ?? p.agency,
      role: data.role ?? p.role,
      location: data.location ?? p.location,
      contract_type: data.contract_type ?? p.contract_type,
      salary: data.salary ?? p.salary,
      salary_amount: data.salary_amount ?? p.salary_amount,
      salary_period: data.salary_period ?? p.salary_period,
      hours_week: data.hours_week ?? p.hours_week,
      source: data.source ?? p.source,
      applied_at: data.applied_at ?? p.applied_at,
      status: data.status ?? p.status,
      job_summary: data.description ?? p.job_summary,
      notes: data.notes ?? p.notes,
      work_mode: data.work_mode ?? p.work_mode,
      benefits: data.benefits ?? p.benefits,
      contact_email: data.contact_email ?? p.contact_email,
    }));
  };

  const importLink = async () => {
    if (!form.job_url) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-job", { body: { url: form.job_url } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      applyImport(data);
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
      if (data?.error) throw new Error(data.error);
      applyImport({ ...data, source: data.source ?? "Screenshot" });
      toast({ title: "Screenshot letto" });
    } catch (e: any) {
      toast({ title: "OCR non riuscito", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const save = async () => {
    if (!user || !form.role?.trim()) {
      toast({ title: "Mancano dati", description: "Il ruolo è richiesto.", variant: "destructive" }); return;
    }
    if (!form.company?.trim() && !form.agency?.trim()) {
      toast({ title: "Mancano dati", description: "Indica almeno Azienda o Agenzia.", variant: "destructive" }); return;
    }
    setBusy(true);
    const payload = {
      user_id: user.id,
      company: form.company?.trim() || null,
      agency: form.agency?.trim() || null,
      role: form.role!.trim(),
      location: form.location || null,
      applied_at: form.applied_at || new Date().toISOString().slice(0, 10),
      source: form.source || null,
      job_url: form.job_url || null,
      contract_type: form.contract_type || null,
      hours_week: form.hours_week || null,
      salary: form.salary || null,
      salary_amount: form.salary_amount ?? null,
      salary_period: form.salary_period || null,
      job_summary: form.job_summary || null,
      work_mode: form.work_mode || null,
      benefits: form.benefits || null,
      contact_email: form.contact_email || null,
      status: (form.status || "in_attesa") as AppStatus,
      notes: form.notes || null,
      priority: (form.priority || "media") as AppPriority,
      follow_up_at: form.follow_up_at || null,
      follow_up_days: form.follow_up_days ?? 30,
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
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Candidatura eliminata" });
    navigate("/applications");
  };

  const toggleArchive = async () => {
    if (!id || isNew) return;
    const archiving = !form.archived_at;
    const { error } = await supabase
      .from("applications")
      .update({ archived_at: archiving ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({
      title: archiving ? "Archiviata" : "Ripristinata",
      description: archiving ? "Verrà eliminata automaticamente fra 90 giorni." : undefined,
    });
    navigate(archiving ? "/applications" : "/archive");
  };

  const convertTo = async (kind: EntityKind) => {
    if (!user || !id || isNew || kind === "application") return;
    setConverting(kind);
    try {
      const res = await convertEntity("application", id, kind, user.id);
      toast({ title: kind === "interview" ? "Spostata in Colloqui" : "Spostata in Corsi" });
      navigate(entityRoute(res.kind, res.id));
    } catch (e: any) {
      toast({ title: "Conversione non riuscita", description: e.message, variant: "destructive" });
    } finally {
      setConverting(null);
    }
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
        {/* Import */}
        <div className="border border-linen bg-card p-4 space-y-3 rounded-2xl">
          <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground">Import smart</p>
          <div className="flex gap-2">
            <Input
              placeholder="https:// link annuncio"
              value={form.job_url ?? ""}
              onChange={(e) => set("job_url", e.target.value)}
              className="rounded-xl"
            />
            <Button type="button" variant="outline" onClick={importLink} disabled={importing || !form.job_url} className="rounded-xl shrink-0">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="w-full rounded-xl">
            <Camera className="h-4 w-4 mr-2" /> {importing ? "Lettura…" : "Carica screenshot (OCR)"}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = "";
          }} />
        </div>

        {/* Tipo voce */}
        {!isNew && (
          <div className="border border-linen bg-card p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground">Tipo voce</p>
            </div>
            <Select value="application" onValueChange={(v) => v !== "application" && convertTo(v as EntityKind)} disabled={!!converting}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="application">{KIND_LABEL.application}</SelectItem>
                <SelectItem value="interview">{KIND_LABEL.interview}</SelectItem>
                <SelectItem value="course">{KIND_LABEL.course}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <Field label="Azienda">
            <Input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} className="rounded-xl" placeholder="Azienda finale" />
          </Field>
          <Field label="Agenzia">
            <Input value={form.agency ?? ""} onChange={(e) => set("agency", e.target.value)} className="rounded-xl" placeholder="Agenzia / intermediario" />
            <p className="text-[10px] text-muted-foreground mt-1">Compila almeno uno tra Azienda o Agenzia.</p>
          </Field>
          <Field label="Ruolo *">
            <Input value={form.role ?? ""} onChange={(e) => set("role", e.target.value)} className="rounded-xl" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Località">
              <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} className="rounded-xl" />
            </Field>
            <Field label="Data candidatura">
              <Input type="date" value={form.applied_at ?? ""} onChange={(e) => set("applied_at", e.target.value)} className="rounded-xl" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fonte">
              <Select value={form.source ?? ""} onValueChange={(v) => set("source", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tipo contratto">
              <Select value={form.contract_type ?? ""} onValueChange={(v) => set("contract_type", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{CONTRACT_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modalità lavoro">
              <Select value={form.work_mode ?? ""} onValueChange={(v) => set("work_mode", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{WORK_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Ore settimanali">
              <Select value={form.hours_week ?? ""} onValueChange={(v) => set("hours_week", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{HOURS_OPTIONS.map(h => <SelectItem key={h} value={h}>{h} ore</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Retribuzione (€)">
              <Input type="number" value={form.salary_amount ?? ""} onChange={(e) => set("salary_amount", e.target.value ? Number(e.target.value) : null)} className="rounded-xl" placeholder="es. 28000" />
            </Field>
            <Field label="Periodo">
              <Select value={form.salary_period ?? "Annuale"} onValueChange={(v) => set("salary_period", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{SALARY_PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Breve descrizione lavoro">
            <Textarea rows={3} value={form.job_summary ?? ""} onChange={(e) => set("job_summary", e.target.value)} className="rounded-xl resize-none" />
          </Field>
          <Field label="Benefit">
            <Textarea rows={2} value={form.benefits ?? ""} onChange={(e) => set("benefits", e.target.value)} className="rounded-xl resize-none" />
          </Field>
          <Field label="Email di contatto">
            <Input type="email" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} className="rounded-xl" />
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
          <Field label="Promemoria follow-up automatico">
            <Select value={String(form.follow_up_days ?? 30)} onValueChange={(v) => set("follow_up_days", Number(v))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Dopo 1 settimana</SelectItem>
                <SelectItem value="14">Dopo 2 settimane</SelectItem>
                <SelectItem value="30">Dopo 1 mese</SelectItem>
                <SelectItem value="60">Dopo 2 mesi</SelectItem>
              </SelectContent>
            </Select>
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="rounded-xl h-11 border-destructive/30 text-destructive hover:bg-destructive/5">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-serif">Eliminare questa candidatura?</AlertDialogTitle>
                  <AlertDialogDescription>L'azione è permanente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {!isNew && (
          <Button
            type="button"
            variant="outline"
            onClick={toggleArchive}
            className="w-full rounded-xl h-11"
          >
            {form.archived_at ? (
              <><RotateCcw className="h-4 w-4 mr-2" /> Ripristina nelle attive</>
            ) : (
              <><ArchiveIcon className="h-4 w-4 mr-2" /> Archivia candidatura</>
            )}
          </Button>
        )}
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
