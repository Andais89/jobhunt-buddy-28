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
import { ArrowLeft, Trash2, Sparkles, Camera, Loader2, ArrowRightLeft, Archive as ArchiveIcon, RotateCcw, ExternalLink, AlertTriangle, Linkedin } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MatchScoreBadge } from "@/components/MatchScoreBadge";
import { findDuplicateApplication, DuplicateMatch } from "@/lib/duplicates";
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
  const [analyzing, setAnalyzing] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [showJDInput, setShowJDInput] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [duplicateOverride, setDuplicateOverride] = useState(false);
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

  // Duplicate detection (debounced)
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(async () => {
      const dup = await findDuplicateApplication({
        userId: user.id,
        jobUrl: form.job_url,
        company: form.company,
        role: form.role,
        excludeId: isNew ? null : id ?? null,
      });
      setDuplicate(dup);
      if (!dup) setDuplicateOverride(false);
    }, 350);
    return () => clearTimeout(t);
  }, [user, form.job_url, form.company, form.role, id, isNew]);

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
      // Auto-trigger match analysis if we got a job description
      const jd = data?.description || data?.notes;
      if (jd && String(jd).length > 30) {
        setTimeout(() => analyzeMatchWith(jd, data?.company ?? form.company, data?.role ?? form.role), 50);
      }
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

  const analyzeMatchWith = async (jd: string, company?: string | null, role?: string | null) => {
    if (!user) return;
    if (!jd || jd.trim().length < 30) {
      toast({ title: "Job Description troppo corta", description: "Incolla almeno 30 caratteri.", variant: "destructive" });
      setShowJDInput(true);
      return;
    }
    setAnalyzing(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("cv_text,skills,experience_summary,languages").eq("user_id", user.id).maybeSingle();
      const profile_text = profile
        ? [profile.cv_text, profile.skills && `Skills: ${profile.skills}`, profile.experience_summary && `Esperienza: ${profile.experience_summary}`, (profile as any).languages && `Lingue: ${(profile as any).languages}`].filter(Boolean).join("\n\n")
        : "";
      const { data, error } = await supabase.functions.invoke("match-analyze", {
        body: { job_text: jd, profile_text, company: company ?? form.company, role: role ?? form.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm(p => ({
        ...p,
        match_score: typeof data.match_score === "number" ? data.match_score : p.match_score,
        gap_analysis: Array.isArray(data.gap_analysis) ? data.gap_analysis : p.gap_analysis,
        job_summary: p.job_summary || data.job_summary || null,
      }));
      toast({ title: "Analisi completata", description: `Match Score: ${data.match_score}/100` });
    } catch (e: any) {
      toast({ title: "Analisi non riuscita", description: e?.message || "Riprova.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeMatch = async () => {
    const jd = (jobDescription.trim() || form.job_summary?.trim() || form.notes?.trim() || "");
    return analyzeMatchWith(jd);
  };

  const [genQs, setGenQs] = useState(false);
  const generateQuestions = async () => {
    if (!user) return;
    const jd = (form.job_summary?.trim() || jobDescription.trim() || form.notes?.trim() || "");
    if (jd.length < 30) {
      toast({ title: "Manca la Job Description", description: "Importa o incolla la descrizione prima.", variant: "destructive" });
      return;
    }
    setGenQs(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("skills,experience_summary").eq("user_id", user.id).maybeSingle();
      const profile_text = profile ? [profile.skills, profile.experience_summary].filter(Boolean).join("\n") : "";
      const { data, error } = await supabase.functions.invoke("interview-questions", {
        body: { job_text: jd, role: form.role, company: form.company, profile_text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list = Array.isArray(data?.questions) ? data.questions : [];
      if (!list.length) throw new Error("Nessuna domanda generata.");
      const formatted = list.map((q: string) => `• ${q}`).join("\n");
      const existing = form.interview_questions?.trim();
      set("interview_questions", existing ? `${existing}\n${formatted}` : formatted);
      toast({ title: "Domande generate", description: `${list.length} domande aggiunte.` });
    } catch (e: any) {
      toast({ title: "Generazione non riuscita", description: e?.message || "Riprova.", variant: "destructive" });
    } finally {
      setGenQs(false);
    }
  };

  const save = async () => {
    if (!user || !form.role?.trim()) {
      toast({ title: "Mancano dati", description: "Il ruolo è richiesto.", variant: "destructive" }); return;
    }
    if (!form.company?.trim() && !form.agency?.trim()) {
      toast({ title: "Mancano dati", description: "Indica almeno Azienda o Agenzia.", variant: "destructive" }); return;
    }
    if (duplicate && !duplicateOverride) {
      toast({ title: "Candidatura duplicata", description: "Conferma 'Aggiungi comunque' per continuare.", variant: "destructive" });
      return;
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
      match_score: form.match_score ?? null,
      gap_analysis: form.gap_analysis ?? null,
      interviewer_name: form.interviewer_name || null,
      interviewer_linkedin: form.interviewer_linkedin || null,
      interview_questions: form.interview_questions || null,
    } as any;
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
        {/* Duplicate alert */}
        {duplicate && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Attenzione: ti sei già candidato per questa posizione!</AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              <p>
                {duplicate.reason === "url" ? "Stesso link annuncio" : "Stessa coppia Azienda + Ruolo"} •{" "}
                <strong>{duplicate.company || duplicate.agency}</strong> — {duplicate.role}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => navigate(`/applications/${duplicate.id}`)}>
                  Apri esistente
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => setDuplicateOverride(true)} disabled={duplicateOverride}>
                  {duplicateOverride ? "Salvataggio sbloccato" : "Aggiungi comunque"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

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
            <Button type="button" variant="outline" onClick={importLink} disabled={importing || !form.job_url} className="rounded-xl shrink-0" title="Fetch dal link">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
            {form.job_url && (
              <a href={form.job_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-10 px-3 rounded-xl border border-input hover:bg-secondary shrink-0" title="Apri annuncio">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="w-full rounded-xl">
            <Camera className="h-4 w-4 mr-2" /> {importing ? "Lettura…" : "Carica screenshot (OCR)"}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = "";
          }} />
        </div>

        {/* AI Match Score & Gap Analysis */}
        <div className="border border-linen bg-card p-4 space-y-3 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground">AI Match Score</p>
            <MatchScoreBadge score={form.match_score} />
          </div>
          {showJDInput ? (
            <Textarea
              rows={4}
              placeholder="Incolla qui la Job Description completa..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="rounded-xl resize-none text-xs"
            />
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {form.job_summary ? "Userò la descrizione del lavoro qui sotto. " : ""}
              <button type="button" onClick={() => setShowJDInput(true)} className="underline">
                Incolla manualmente la Job Description
              </button>
            </p>
          )}
          <Button type="button" variant="outline" onClick={analyzeMatch} disabled={analyzing} className="w-full rounded-xl">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {form.match_score !== null && form.match_score !== undefined ? "Ricalcola Match" : "Calcola Match Score"}
          </Button>
          {form.gap_analysis && Array.isArray(form.gap_analysis) && form.gap_analysis.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-1.5">Gap analysis</p>
              <ul className="space-y-1">
                {(form.gap_analysis as string[]).map((g, i) => (
                  <li key={i} className="text-xs flex gap-1.5"><span className="text-muted-foreground">•</span><span>{g}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Interview Prep */}
        <div className="border border-linen bg-card p-4 space-y-3 rounded-2xl">
          <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground">Preparazione colloquio</p>
          <Field label="Nome intervistatore">
            <Input
              value={form.interviewer_name ?? ""}
              onChange={(e) => set("interviewer_name", e.target.value)}
              placeholder="Mario Rossi"
              className="rounded-xl"
            />
          </Field>
          {form.interviewer_name?.trim() && (
            <a
              href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(form.interviewer_name.trim() + (form.company ? " " + form.company : ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-accent hover:underline"
            >
              <Linkedin className="h-3.5 w-3.5" /> Cerca su LinkedIn
            </a>
          )}
          <Field label="LinkedIn intervistatore (opzionale)">
            <Input
              value={form.interviewer_linkedin ?? ""}
              onChange={(e) => set("interviewer_linkedin", e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
              className="rounded-xl"
            />
          </Field>
          <Field label="Domande previste / Note di prep">
            <Textarea
              rows={4}
              value={form.interview_questions ?? ""}
              onChange={(e) => set("interview_questions", e.target.value)}
              placeholder="• Parlami di te&#10;• Perché vuoi lavorare qui?&#10;• ..."
              className="rounded-xl resize-none"
            />
          </Field>
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
          <Button onClick={save} disabled={busy || (!!duplicate && !duplicateOverride)} className="flex-1 rounded-xl h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (duplicate && !duplicateOverride ? "Risolvi duplicato" : "Salva")}
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
