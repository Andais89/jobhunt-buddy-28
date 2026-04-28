import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppStatus, CourseStatus, STATUS_LABEL } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";

const STATUSES: AppStatus[] = ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"];
const COURSE_STATUSES: { v: CourseStatus; l: string }[] = [
  { v: "interessato", l: "Interessato" },
  { v: "iscritto", l: "Iscritto" },
  { v: "in_corso", l: "In corso" },
  { v: "completato", l: "Completato" },
  { v: "rifiutato", l: "Rifiutato" },
];

type Entity = "candidatura" | "corso";

type ImportPayload = {
  company?: string;
  agency?: string;
  role?: string;
  location?: string;
  contract_type?: string;
  salary?: string;
  source?: string;
  description?: string;
  notes?: string;
  status?: AppStatus;
  applied_at?: string;
  work_mode?: string;
  seniority_level?: string;
  benefits?: string;
  contact_email?: string;
  error?: string;
};

export function QuickAddDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void;
}) {
  const { user } = useAuth();
  const [entity, setEntity] = useState<Entity>("candidatura");

  // Application fields
  const [company, setCompany] = useState("");
  const [agency, setAgency] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [contractType, setContractType] = useState("");
  const [salary, setSalary] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<AppStatus>("in_attesa");
  const [link, setLink] = useState("");
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [jobSummary, setJobSummary] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [benefits, setBenefits] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Course fields
  const [courseName, setCourseName] = useState("");
  const [courseProvider, setCourseProvider] = useState("");
  const [courseStart, setCourseStart] = useState("");
  const [courseDeadline, setCourseDeadline] = useState("");
  const [courseStatus, setCourseStatus] = useState<CourseStatus>("interessato");
  const [courseUrl, setCourseUrl] = useState("");
  const [courseNotes, setCourseNotes] = useState("");

  const reset = () => {
    setEntity("candidatura");
    setCompany(""); setAgency(""); setRole(""); setLocation(""); setContractType("");
    setSalary(""); setNotes(""); setSource(""); setStatus("in_attesa"); setLink("");
    setAppliedAt(new Date().toISOString().slice(0, 10)); setJobSummary(""); setWorkMode("");
    setSeniorityLevel(""); setBenefits(""); setContactEmail("");
    setCourseName(""); setCourseProvider(""); setCourseStart(""); setCourseDeadline("");
    setCourseStatus("interessato"); setCourseUrl(""); setCourseNotes("");
  };

  const applyImport = (data: ImportPayload) => {
    if (data.company) setCompany(data.company);
    if (data.agency) setAgency(data.agency);
    if (data.role) setRole(data.role);
    if (data.location) setLocation(data.location);
    if (data.contract_type) setContractType(data.contract_type);
    if (data.salary) setSalary(data.salary);
    if (data.source) setSource(data.source);
    if (data.status) setStatus(data.status);
    if (data.applied_at) setAppliedAt(data.applied_at);
    if (data.description) setJobSummary(data.description);
    if (data.notes) setNotes(data.notes);
    if (data.work_mode) setWorkMode(data.work_mode);
    if (data.seniority_level) setSeniorityLevel(data.seniority_level);
    if (data.benefits) setBenefits(data.benefits);
    if (data.contact_email) setContactEmail(data.contact_email);
  };

  const importFromLink = async () => {
    if (!link.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-job", { body: { url: link.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      applyImport(data ?? {});
      toast({ title: "Importazione completata", description: "I campi trovati sono stati compilati automaticamente." });
    } catch (e: any) {
      toast({
        title: "Importazione non riuscita",
        description: e.message ?? "Impossibile leggere questa fonte. Prova con un altro link.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
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
    setSaving(true);
    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      company: company.trim() || null,
      agency: agency.trim() || null,
      role: role.trim(),
      location: location.trim() || null,
      contract_type: contractType.trim() || null,
      salary: salary.trim() || null,
      notes: notes.trim() || null,
      source: source.trim() || null,
      status,
      job_url: link.trim() || null,
      applied_at: appliedAt || new Date().toISOString().slice(0, 10),
      job_summary: jobSummary.trim() || null,
      work_mode: workMode.trim() || null,
      seniority_level: seniorityLevel.trim() || null,
      benefits: benefits.trim() || null,
      contact_email: contactEmail.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvata", description: `${company.trim() || agency.trim()} • ${role}` });
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  const saveCourse = async () => {
    if (!user) return;
    if (!courseName.trim()) {
      toast({ title: "Dati mancanti", description: "Il nome del corso è richiesto.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("courses").insert({
      user_id: user.id,
      name: courseName.trim(),
      provider: courseProvider.trim() || null,
      start_date: courseStart || null,
      enrollment_deadline: courseDeadline || null,
      status: courseStatus,
      url: courseUrl.trim() || null,
      notes: courseNotes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Corso salvato", description: courseName.trim() });
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
          {/* Entity toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-foreground/5 rounded-xl">
            <button
              type="button"
              onClick={() => setEntity("candidatura")}
              className={`py-2 text-[10px] uppercase tracking-editorial font-semibold rounded-lg transition ${
                entity === "candidatura" ? "bg-background shadow-soft" : "text-muted-foreground"
              }`}
            >
              Candidatura
            </button>
            <button
              type="button"
              onClick={() => setEntity("corso")}
              className={`py-2 text-[10px] uppercase tracking-editorial font-semibold rounded-lg transition ${
                entity === "corso" ? "bg-background shadow-soft" : "text-muted-foreground"
              }`}
            >
              Corso
            </button>
          </div>

          {entity === "candidatura" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="link" className="text-[10px] uppercase tracking-editorial">Link annuncio (opzionale)</Label>
                <div className="flex gap-2">
                  <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="rounded-xl" />
                  <Button type="button" variant="outline" onClick={importFromLink} disabled={importing || !link.trim()} className="rounded-xl shrink-0">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="text-[10px] uppercase tracking-editorial">Azienda</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-xl" placeholder="Azienda finale" autoFocus />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agency" className="text-[10px] uppercase tracking-editorial">Agenzia</Label>
                <Input id="agency" value={agency} onChange={(e) => setAgency(e.target.value)} className="rounded-xl" placeholder="Agenzia / intermediario" />
                <p className="text-[10px] text-muted-foreground">Compila almeno uno tra Azienda o Agenzia.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-[10px] uppercase tracking-editorial">Ruolo *</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-[10px] uppercase tracking-editorial">Località</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appliedAt" className="text-[10px] uppercase tracking-editorial">Data candidatura</Label>
                  <Input id="appliedAt" type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} className="rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-editorial">Stato</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as AppStatus)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractType" className="text-[10px] uppercase tracking-editorial">Contratto</Label>
                  <Input id="contractType" value={contractType} onChange={(e) => setContractType(e.target.value)} className="rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="salary" className="text-[10px] uppercase tracking-editorial">Retribuzione</Label>
                  <Input id="salary" value={salary} onChange={(e) => setSalary(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source" className="text-[10px] uppercase tracking-editorial">Fonte</Label>
                  <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} className="rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="workMode" className="text-[10px] uppercase tracking-editorial">Remoto / Ibrido / In sede</Label>
                  <Input id="workMode" value={workMode} onChange={(e) => setWorkMode(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seniority" className="text-[10px] uppercase tracking-editorial">Livello esperienza</Label>
                  <Input id="seniority" value={seniorityLevel} onChange={(e) => setSeniorityLevel(e.target.value)} className="rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary" className="text-[10px] uppercase tracking-editorial">Breve descrizione lavoro</Label>
                <Textarea id="summary" rows={3} value={jobSummary} onChange={(e) => setJobSummary(e.target.value)} className="rounded-xl resize-none" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-[10px] uppercase tracking-editorial">Note / Requisiti</Label>
                <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl resize-none" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits" className="text-[10px] uppercase tracking-editorial">Benefit / Vantaggi</Label>
                <Textarea id="benefits" rows={2} value={benefits} onChange={(e) => setBenefits(e.target.value)} className="rounded-xl resize-none" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-[10px] uppercase tracking-editorial">Email di contatto</Label>
                <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="rounded-xl" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="cname" className="text-[10px] uppercase tracking-editorial">Nome corso *</Label>
                <Input id="cname" value={courseName} onChange={(e) => setCourseName(e.target.value)} className="rounded-xl" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cprov" className="text-[10px] uppercase tracking-editorial">Ente / Provider</Label>
                <Input id="cprov" value={courseProvider} onChange={(e) => setCourseProvider(e.target.value)} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cstart" className="text-[10px] uppercase tracking-editorial">Data inizio</Label>
                  <Input id="cstart" type="date" value={courseStart} onChange={(e) => setCourseStart(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cdead" className="text-[10px] uppercase tracking-editorial">Scadenza iscrizione</Label>
                  <Input id="cdead" type="date" value={courseDeadline} onChange={(e) => setCourseDeadline(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-editorial">Stato</Label>
                <Select value={courseStatus} onValueChange={(v) => setCourseStatus(v as CourseStatus)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COURSE_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="curl" className="text-[10px] uppercase tracking-editorial">Link</Label>
                <Input id="curl" value={courseUrl} onChange={(e) => setCourseUrl(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnotes" className="text-[10px] uppercase tracking-editorial">Note</Label>
                <Textarea id="cnotes" rows={3} value={courseNotes} onChange={(e) => setCourseNotes(e.target.value)} className="rounded-xl resize-none" />
              </div>
            </>
          )}

          <Button onClick={save} disabled={saving} className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
