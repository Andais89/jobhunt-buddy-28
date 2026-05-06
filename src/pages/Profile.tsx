import { useEffect, useRef, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  biometricAvailable,
  biometricEnvSupported,
  biometricEnabledForUser,
  enableBiometric,
  disableBiometric,
} from "@/lib/biometric";
import {
  pushSupported, pushPermission, pushEnabled,
  enablePush, disablePush, isStandalone,
} from "@/lib/notifications";
import { Fingerprint, Info, Bell, User as UserIcon, Loader2, FileUp } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>("default");
  const envOk = biometricEnvSupported();
  const standalone = isStandalone();
  const pushOk = pushSupported();

  // Profilo candidato (per Match Score AI)
  const [displayName, setDisplayName] = useState("");
  const [cvText, setCvText] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [languages, setLanguages] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [parsingCv, setParsingCv] = useState(false);
  const cvFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Profilo — Regia Carriera";
    biometricAvailable().then(setAvailable);
    if (user) setEnabled(biometricEnabledForUser(user.id));
    setPushOn(pushEnabled());
    setPushPerm(pushPermission());
    if (user) {
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setCvText(data.cv_text ?? "");
          setSkills(data.skills ?? "");
          setExperience(data.experience_summary ?? "");
          setLanguages((data as any).languages ?? "");
        }
      });
    }
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const payload = {
      user_id: user.id,
      display_name: displayName.trim() || null,
      cv_text: cvText.trim() || null,
      skills: skills.trim() || null,
      experience_summary: experience.trim() || null,
      languages: languages.trim() || null,
    } as any;
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    setSavingProfile(false);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Profilo salvato", description: "Verrà usato per il Match Score AI." });
  };

  const toggle = async (next: boolean) => {
    if (!user) return;
    if (next && !available) return;
    setBusy(true);
    try {
      if (next) {
        await enableBiometric(user.id, user.email ?? "user");
        setEnabled(true);
        toast({ title: "Face ID attivo", description: "Userai il riconoscimento per sbloccare l'app." });
      } else {
        disableBiometric();
        setEnabled(false);
        toast({ title: "Face ID disattivato" });
      }
    } catch (e: any) {
      const msg = String(e?.name ?? "") === "NotAllowedError"
        ? "Operazione annullata."
        : "Non è stato possibile attivare Face ID su questo dispositivo.";
      toast({ title: "Face ID non attivato", description: msg });
    } finally {
      setBusy(false);
    }
  };

  const togglePush = async (next: boolean) => {
    if (next) {
      const perm = await enablePush();
      setPushPerm(perm);
      if (perm === "granted") {
        setPushOn(true);
        toast({ title: "Notifiche push attive", description: "Riceverai promemoria importanti." });
      } else if (perm === "denied") {
        toast({
          title: "Permesso negato",
          description: "Abilita le notifiche dalle impostazioni del browser/iPhone.",
          variant: "destructive",
        });
      }
    } else {
      disablePush();
      setPushOn(false);
      toast({ title: "Notifiche push disattivate" });
    }
  };

  const handleCvPdf = async (file: File) => {
    if (!user) return;
    setParsingCv(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) throw new Error("Carica un file PDF.");
      if (file.size > 15 * 1024 * 1024) throw new Error("File troppo grande (max 15MB).");

      // Convert file to base64 and send to parse-pdf edge function
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const pdfBase64 = btoa(bin);

      const { data: parsed, error: parseErr } = await supabase.functions.invoke("parse-pdf", { body: { pdfBase64 } });
      if (parseErr) throw parseErr;
      if (parsed?.error) throw new Error(parsed.error);
      const extractedText = String(parsed?.text || "").trim();
      if (!extractedText) throw new Error("Nessun testo estratto dal PDF.");
      setCvText(extractedText);

      // Optional: structure with AI using existing extract-cv function
      const { data, error } = await supabase.functions.invoke("extract-cv", { body: { cv_text: extractedText } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.cv_text) setCvText(data.cv_text);
      if (data?.display_name && !displayName) setDisplayName(data.display_name);
      if (data?.skills) setSkills(data.skills);
      if (data?.experience_summary) setExperience(data.experience_summary);
      if (data?.languages) setLanguages(data.languages);
      toast({ title: "CV importato", description: "Rivedi i campi e salva." });
    } catch (e: any) {
      toast({ title: "Errore lettura CV", description: e?.message || "Riprova.", variant: "destructive" });
    } finally {
      setParsingCv(false);
    }
  };

  const helperBio = !envOk
    ? "Per attivare Face ID, apri l'app installata dalla schermata Home (Condividi → Aggiungi a Home)."
    : !available
    ? "Questo dispositivo non supporta il riconoscimento biometrico."
    : null;

  const helperPush = !pushOk
    ? "Notifiche push non supportate da questo browser."
    : !standalone && /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? "Su iPhone le notifiche push funzionano solo se installi l'app dalla Home (Condividi → Aggiungi a Home). I promemoria in-app restano sempre visibili."
    : pushPerm === "denied"
    ? "Hai negato il permesso. Riattivalo dalle impostazioni del sistema."
    : null;

  return (
    <MobileShell title="Profilo" subtitle="Account & sicurezza">
      <div className="px-6 space-y-8">
        <section>
          <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-3">Account</p>
          <div className="rounded-2xl border border-linen bg-paper p-4">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium mt-1 break-all">{user?.email}</p>
          </div>
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-3">Profilo candidato</p>
          <div className="rounded-2xl border border-linen bg-paper p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
                <UserIcon className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Questi dati vengono usati dall'AI per calcolare il <strong>Match Score</strong> e la <strong>Gap Analysis</strong> sulle candidature.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-editorial">Nome</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl" placeholder="Es. Mario Rossi" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-editorial">Skills principali</Label>
              <Textarea rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} className="rounded-xl resize-none" placeholder="React, TypeScript, Node.js, SQL..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-editorial">Lingue</Label>
              <Textarea rows={2} value={languages} onChange={(e) => setLanguages(e.target.value)} className="rounded-xl resize-none" placeholder="Italiano madrelingua, Inglese B2..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-editorial">Esperienza in sintesi</Label>
              <Textarea rows={3} value={experience} onChange={(e) => setExperience(e.target.value)} className="rounded-xl resize-none" placeholder="Es. 3 anni come frontend developer in startup SaaS..." />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[10px] uppercase tracking-editorial">CV completo</Label>
                <button type="button" onClick={() => cvFileRef.current?.click()} disabled={parsingCv} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-editorial font-semibold text-accent hover:underline disabled:opacity-50">
                  {parsingCv ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
                  {parsingCv ? "Analisi…" : "Carica PDF"}
                </button>
                <input ref={cvFileRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCvPdf(f); e.target.value = ""; }} />
              </div>
              <Textarea rows={6} value={cvText} onChange={(e) => setCvText(e.target.value)} className="rounded-xl resize-none text-xs" placeholder="Carica il PDF o incolla qui il testo del CV..." />
            </div>
            <Button onClick={saveProfile} disabled={savingProfile} className="w-full rounded-xl">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva profilo"}
            </Button>
          </div>
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-3">Notifiche</p>
          <div className="rounded-2xl border border-linen bg-paper p-4 flex items-center gap-4">
            <div className="size-10 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Notifiche push del sistema</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Promemoria follow-up, colloqui e corsi anche con app chiusa.
              </p>
            </div>
            <Switch checked={pushOn} disabled={!pushOk || pushPerm === "denied"} onCheckedChange={togglePush} />
          </div>
          {helperPush && (
            <div className="mt-3 flex gap-2 items-start rounded-xl bg-foreground/[0.03] border border-linen px-3 py-2.5">
              <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">{helperPush}</p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            I promemoria in-app sono <strong>sempre attivi</strong> nella Dashboard, anche senza permessi push.
          </p>
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-3">Sicurezza</p>
          <div className="rounded-2xl border border-linen bg-paper p-4 flex items-center gap-4">
            <div className="size-10 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
              <Fingerprint className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Sblocco con Face ID</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {available
                  ? "Accesso rapido senza password ad ogni apertura."
                  : "Disponibile solo nell'app installata sulla Home."}
              </p>
            </div>
            <Switch checked={enabled} disabled={!available || busy} onCheckedChange={toggle} />
          </div>
          {helperBio && (
            <div className="mt-3 flex gap-2 items-start rounded-xl bg-foreground/[0.03] border border-linen px-3 py-2.5">
              <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">{helperBio}</p>
            </div>
          )}

          {/* Diagnostica Face ID PWA */}
          <details className="mt-3 text-[11px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition">Diagnostica avanzata</summary>
            <div className="mt-2 rounded-xl bg-foreground/[0.03] border border-linen p-3 space-y-1 font-mono text-[10px]">
              <p>PWA installata (standalone): <strong>{standalone ? "sì" : "no"}</strong></p>
              <p>Ambiente WebAuthn ok: <strong>{envOk ? "sì" : "no"}</strong></p>
              <p>Autenticatore biometrico: <strong>{available ? "sì" : "no"}</strong></p>
              <p>Hostname: <strong>{typeof window !== "undefined" ? window.location.hostname : "—"}</strong></p>
              <p>Secure context: <strong>{typeof window !== "undefined" ? String(window.isSecureContext) : "—"}</strong></p>
            </div>
          </details>
        </section>
      </div>
    </MobileShell>
  );
}
