import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AppStatus, CourseStatus, STATUS_LABEL,
  WORK_MODES, CONTRACT_TYPES, HOURS_OPTIONS, SALARY_PERIODS,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2, AlertTriangle, ImagePlus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { findDuplicateApplication, DuplicateMatch } from "@/lib/duplicates";
import { MatchScoreBadge } from "@/components/MatchScoreBadge";
import { useNavigate } from "react-router-dom";

const STATUSES: AppStatus[] = ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"];
const COURSE_STATUSES: { v: CourseStatus; l: string }[] = [
  { v: "interessato", l: "Interessato" },
  { v: "iscritto", l: "Iscritto" },
  { v: "in_corso", l: "In corso" },
  { v: "completato", l: "Completato" },
  { v: "rifiutato", l: "Rifiutato" },
];

type Entity = "candidatura" | "corso";

export function QuickAddDialog({ open, onOpenChange, onCreated, initialLink, autoImport }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void;
  initialLink?: string; autoImport?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<Entity>("candidatura");

  // App fields
  const [company, setCompany] = useState("");
  const [agency, setAgency] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [contractType, setContractType] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [hoursWeek, setHoursWeek] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState<string>("Annuale");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<AppStatus>("in_attesa");
  const [link, setLink] = useState("");
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI Match
  const [jobDescription, setJobDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<string[] | null>(null);
  const [showJDInput, setShowJDInput] = useState(false);

  // Duplicate
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [duplicateOverride, setDuplicateOverride] = useState(false);

  // Course fields
  const [courseName, setCourseName] = useState("");
  const [courseProvider, setCourseProvider] = useState("");
  const [courseStart, setCourseStart] = useState("");
  const [courseEnd, setCourseEnd] = useState("");
  const [courseDeadline, setCourseDeadline] = useState("");
  const [courseStatus, setCourseStatus] = useState<CourseStatus>("interessato");

  // Pre-fill link and optionally trigger import when opened from clipboard banner
  useEffect(() => {
    if (open && initialLink) {
      setEntity("candidatura");
      setLink(initialLink);
      if (autoImport) {
        // small delay so the dialog renders before invoking
        setTimeout(() => { void importFromLinkValue(initialLink); }, 150);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLink, autoImport]);

  const reset = () => {
    setEntity("candidatura");
    setCompany(""); setAgency(""); setRole(""); setLocation(""); setContractType("");
    setWorkMode(""); setHoursWeek(""); setSalaryAmount(""); setSalaryPeriod("Annuale");
    setNotes(""); setSource(""); setStatus("in_attesa"); setLink("");
    setAppliedAt(new Date().toISOString().slice(0, 10));
    setCourseName(""); setCourseProvider(""); setCourseStart(""); setCourseEnd("");
    setCourseDeadline(""); setCourseStatus("interessato");
    setJobDescription(""); setMatchScore(null); setGapAnalysis(null); setShowJDInput(false);
    setDuplicate(null); setDuplicateOverride(false);
  };

  // Re-check duplicates when key fields change
  useEffect(() => {
    if (!user || entity !== "candidatura") return;
    const t = setTimeout(async () => {
      const dup = await findDuplicateApplication({
        userId: user.id,
        jobUrl: link,
        company,
        role,
      });
      setDuplicate(dup);
      if (!dup) setDuplicateOverride(false);
    }, 350);
    return () => clearTimeout(t);
  }, [user, entity, link, company, role]);

  const importFromLinkValue = async (url: string) => {
    if (!url.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-job", { body: { url: url.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.company) setCompany(data.company);
      if (data.agency) setAgency(data.agency);
      if (data.role) setRole(data.role);
      if (data.location) setLocation(data.location);
      if (data.contract_type) setContractType(data.contract_type);
      if (data.work_mode) setWorkMode(data.work_mode);
      if (data.salary_amount) setSalaryAmount(String(data.salary_amount));
      if (data.salary_period) setSalaryPeriod(data.salary_period);
      if (data.hours_week) setHoursWeek(data.hours_week);
      if (data.source) setSource(data.source);
      if (data.notes) setNotes(data.notes);
      // applied_at: ignorato dall'import — usiamo sempre la data odierna al salvataggio
      if (data.description) setJobDescription(data.description);
      toast({ title: "Importazione completata", description: "Ora puoi calcolare il Match Score." });
    } catch (e: any) {
      toast({
        title: "Importazione non riuscita",
        description: (e?.message || "Impossibile leggere automaticamente.") + " Incolla la Job Description manualmente per analizzarla.",
        variant: "destructive",
      });
      setShowJDInput(true);
    } finally {
      setImporting(false);
    }
  };
  const importFromLink = () => importFromLinkValue(link);

  const analyzeMatch = async () => {
    if (!user) return;
    const jd = jobDescription.trim() || notes.trim();
    if (jd.length < 30) {
      toast({ title: "Job Description troppo corta", description: "Incolla almeno una descrizione di 30+ caratteri.", variant: "destructive" });
      setShowJDInput(true);
      return;
    }
    setAnalyzing(true);
    try {
      // Load profile
      const { data: profile } = await supabase.from("profiles").select("cv_text,skills,experience_summary").eq("user_id", user.id).maybeSingle();
      const profile_text = profile
        ? [profile.cv_text, profile.skills && `Skills: ${profile.skills}`, profile.experience_summary && `Esperienza: ${profile.experience_summary}`].filter(Boolean).join("\n\n")
        : "";
      const { data, error } = await supabase.functions.invoke("match-analyze", {
        body: { job_text: jd, profile_text, company, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMatchScore(typeof data.match_score === "number" ? data.match_score : null);
      setGapAnalysis(Array.isArray(data.gap_analysis) ? data.gap_analysis : null);
      if (data.job_summary && !notes.trim()) setNotes(data.job_summary);
      toast({ title: "Analisi completata", description: `Match Score: ${data.match_score}/100` });
    } catch (e: any) {
      toast({ title: "Analisi non riuscita", description: e?.message || "Riprova.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const saveApplication = async () => {
    if (!user) return;
    if (!company.trim() && !agency.trim()) {
      toast({ title: "Dati mancanti", description: "Indica almeno Azienda o Agenzia.", variant: "destructive" });
      return;
    }
    if (!role.trim()) {
      toast({ title: "Dati mancanti", description: "Il ruolo è richiesto.", variant: "destructive" });
      return;
    }
    if (duplicate && !duplicateOverride) {
      toast({ title: "Candidatura duplicata", description: "Conferma 'Aggiungi comunque' per continuare.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      company: company.trim() || null,
      agency: agency.trim() || null,
      role: role.trim(),
      location: location.trim() || null,
      contract_type: contractType || null,
      work_mode: workMode || null,
      hours_week: hoursWeek || null,
      salary_amount: salaryAmount ? Number(salaryAmount) : null,
      salary_period: salaryPeriod || null,
      notes: notes.trim() || null,
      source: source.trim() || null,
      status,
      job_url: link.trim() || null,
      applied_at: new Date().toISOString().slice(0, 10),
      match_score: matchScore,
      gap_analysis: gapAnalysis,
    } as any);
    setSaving(false);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salvata", description: `${company.trim() || agency.trim()} • ${role}` });
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  const saveCourse = async () => {
    if (!user || !courseName.trim()) {
      toast({ title: "Nome richiesto", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await supabase.from("courses").insert({
      user_id: user.id,
      name: courseName.trim(),
      provider: courseProvider.trim() || null,
      start_date: courseStart || null,
      end_date: courseEnd || null,
      enrollment_date: new Date().toISOString().slice(0, 10),
      enrollment_deadline: courseDeadline || null,
      status: courseStatus,
    });
    setSaving(false);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Corso salvato" });
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  const save = () => entity === "candidatura" ? saveApplication() : saveCourse();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-[420px] rounded-2xl border-linen">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Aggiunta Rapida</DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-editorial text-muted-foreground">
            In meno di 60 secondi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2 max-h-[78vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-2 p-1 bg-foreground/5 rounded-xl">
            <button type="button" onClick={() => setEntity("candidatura")}
              className={`py-2 text-[10px] uppercase tracking-editorial font-semibold rounded-lg transition ${entity === "candidatura" ? "bg-background shadow-soft" : "text-muted-foreground"}`}>
              Candidatura
            </button>
            <button type="button" onClick={() => setEntity("corso")}
              className={`py-2 text-[10px] uppercase tracking-editorial font-semibold rounded-lg transition ${entity === "corso" ? "bg-background shadow-soft" : "text-muted-foreground"}`}>
              Corso
            </button>
          </div>

          {entity === "candidatura" ? (
            <>
              <Field label="Link annuncio (opzionale)">
                <div className="flex gap-2">
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="rounded-xl" />
                  <Button type="button" variant="outline" onClick={importFromLink} disabled={importing || !link.trim()} className="rounded-xl shrink-0" title="Fetch automatico dal link">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </div>
              </Field>

              {/* Duplicate alert */}
              {duplicate && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Attenzione: ti sei già candidato per questa posizione!</AlertTitle>
                  <AlertDescription className="text-xs space-y-2">
                    <p>
                      {duplicate.reason === "url" ? "Stesso link annuncio già salvato" : "Stessa coppia Azienda + Ruolo già presente"} •{" "}
                      <strong>{duplicate.company || duplicate.agency}</strong> — {duplicate.role}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => { onOpenChange(false); navigate(`/applications/${duplicate.id}`); }}>
                        Apri esistente
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => setDuplicateOverride(true)} disabled={duplicateOverride}>
                        {duplicateOverride ? "Pronto a salvare" : "Aggiungi comunque"}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Match Score / Gap Analysis */}
              <div className="rounded-xl border border-linen bg-paper p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground">AI Match Score</p>
                  {matchScore !== null && <MatchScoreBadge score={matchScore} />}
                </div>
                {showJDInput || (!link.trim() && matchScore === null) ? (
                  <Textarea
                    rows={3}
                    placeholder="Incolla qui la Job Description per calcolare il match..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="rounded-xl resize-none text-xs"
                  />
                ) : (
                  <button type="button" onClick={() => setShowJDInput(true)} className="text-[11px] text-muted-foreground underline">
                    Incolla manualmente la Job Description
                  </button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={analyzeMatch} disabled={analyzing} className="w-full h-9 rounded-lg text-xs">
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
                  {matchScore !== null ? "Ricalcola Match" : "Calcola Match Score"}
                </Button>
                {gapAnalysis && gapAnalysis.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] uppercase tracking-editorial font-semibold text-muted-foreground mb-1">Gap analysis</p>
                    <ul className="space-y-1">
                      {gapAnalysis.slice(0, 5).map((g, i) => (
                        <li key={i} className="text-[11px] text-foreground flex gap-1.5"><span className="text-muted-foreground">•</span><span>{g}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <Field label="Azienda"><Input value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-xl" placeholder="Azienda finale" autoFocus /></Field>
              <Field label="Agenzia">
                <Input value={agency} onChange={(e) => setAgency(e.target.value)} className="rounded-xl" placeholder="Agenzia / intermediario" />
                <p className="text-[10px] text-muted-foreground mt-1">Compila almeno uno tra Azienda o Agenzia.</p>
              </Field>
              <Field label="Ruolo *"><Input value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl" /></Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Località"><Input value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-xl" /></Field>
                <Field label="Data candidatura"><Input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} className="rounded-xl" /></Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Stato">
                  <Select value={status} onValueChange={(v) => setStatus(v as AppStatus)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Tipo contratto">
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{CONTRACT_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Modalità lavoro">
                  <Select value={workMode} onValueChange={setWorkMode}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{WORK_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Ore settimanali">
                  <Select value={hoursWeek} onValueChange={setHoursWeek}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{HOURS_OPTIONS.map(h => <SelectItem key={h} value={h}>{h} ore</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field label="Retribuzione (€)">
                  <Input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} className="rounded-xl" placeholder="es. 28000" />
                </Field>
                <Field label="Periodo">
                  <Select value={salaryPeriod} onValueChange={setSalaryPeriod}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{SALARY_PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Fonte"><Input value={source} onChange={(e) => setSource(e.target.value)} className="rounded-xl" placeholder="Es. LinkedIn" /></Field>
              <Field label="Note / Requisiti"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl resize-none" /></Field>
            </>
          ) : (
            <>
              <Field label="Nome corso *"><Input value={courseName} onChange={(e) => setCourseName(e.target.value)} className="rounded-xl" autoFocus /></Field>
              <Field label="Ente / Scuola"><Input value={courseProvider} onChange={(e) => setCourseProvider(e.target.value)} className="rounded-xl" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data inizio"><Input type="date" value={courseStart} onChange={(e) => setCourseStart(e.target.value)} className="rounded-xl" /></Field>
                <Field label="Data fine"><Input type="date" value={courseEnd} onChange={(e) => setCourseEnd(e.target.value)} className="rounded-xl" /></Field>
              </div>
              <Field label="Scadenza iscrizione"><Input type="date" value={courseDeadline} onChange={(e) => setCourseDeadline(e.target.value)} className="rounded-xl" /></Field>
              <Field label="Stato">
                <Select value={courseStatus} onValueChange={(v) => setCourseStatus(v as CourseStatus)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{COURSE_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </>
          )}

          <Button onClick={save} disabled={saving || (entity === "candidatura" && !!duplicate && !duplicateOverride)} className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (entity === "candidatura" && duplicate && !duplicateOverride ? "Risolvi duplicato per salvare" : "Salva")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
