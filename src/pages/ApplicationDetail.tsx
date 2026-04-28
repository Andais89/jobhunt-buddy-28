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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Sparkles, Camera, Loader2, ArrowRightLeft } from "lucide-react";
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
    applied_at: new Date().toISOString().slice(0, 10), job_summary: "", work_mode: "", seniority_level: "", benefits: "", contact_email: "",
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

  const importLink = async () => {
    if (!form.job_url) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-job", { body: { url: form.job_url } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm(p => ({
        ...p,
        company: data.company ?? p.company,
        agency: data.agency ?? p.agency,
        role: data.role ?? p.role,
        location: data.location ?? p.location,
        contract_type: data.contract_type ?? p.contract_type,
        salary: data.salary ?? p.salary,
        source: data.source ?? p.source,
        applied_at: data.applied_at ?? p.applied_at,
        status: data.status ?? p.status,
        job_summary: data.description ?? p.job_summary,
        notes: data.notes ?? p.notes,
        work_mode: data.work_mode ?? p.work_mode,
        seniority_level: data.seniority_level ?? p.seniority_level,
        benefits: data.benefits ?? p.benefits,
        contact_email: data.contact_email ?? p.contact_email,
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
      if (data?.error) throw new Error(data.error);
      setForm(p => ({
        ...p,
        company: data.company ?? p.company,
        agency: data.agency ?? p.agency,
        role: data.role ?? p.role,
        location: data.location ?? p.location,
        contract_type: data.contract_type ?? p.contract_type,
        salary: data.salary ?? p.salary,
        source: data.source ?? p.source ?? "Screenshot",
        applied_at: data.applied_at ?? p.applied_at,
        status: data.status ?? p.status,
        job_summary: data.description ?? p.job_summary,
        notes: data.notes ?? p.notes,
        work_mode: data.work_mode ?? p.work_mode,
        seniority_level: data.seniority_level ?? p.seniority_level,
        benefits: data.benefits ?? p.benefits,
        contact_email: data.contact_email ?? p.contact_email,
      }));
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
      salary: form.salary || null,
      job_summary: form.job_summary || null,
      work_mode: form.work_mode || null,
      seniority_level: form.seniority_level || null,
      benefits: form.benefits || null,
      contact_email: form.contact_email || null,
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
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Candidatura eliminata", description: "L'elemento è stato rimosso." });
    navigate("/applications");
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
            <Field label="Remote / Hybrid / On-site">
              <Input value={form.work_mode ?? ""} onChange={(e) => set("work_mode", e.target.value)} className="rounded-xl" />
            </Field>
            <Field label="Seniority">
              <Input value={form.seniority_level ?? ""} onChange={(e) => set("seniority_level", e.target.value)} className="rounded-xl" />
            </Field>
          </div>
          <Field label="Short job description">
            <Textarea rows={3} value={form.job_summary ?? ""} onChange={(e) => set("job_summary", e.target.value)} className="rounded-xl resize-none" />
          </Field>
          <Field label="Benefits">
            <Textarea rows={2} value={form.benefits ?? ""} onChange={(e) => set("benefits", e.target.value)} className="rounded-xl resize-none" />
          </Field>
          <Field label="Contact email">
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="rounded-xl h-11 border-destructive/30 text-destructive hover:bg-destructive/5">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-serif">Eliminare questa candidatura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'azione è permanente e non può essere annullata.
                  </AlertDialogDescription>
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
