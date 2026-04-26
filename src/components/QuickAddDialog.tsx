import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppStatus, STATUS_LABEL } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";

const STATUSES: AppStatus[] = ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"];

export function QuickAddDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void;
}) {
  const { user } = useAuth();
  const [company, setCompany] = useState("");
  const [agency, setAgency] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<AppStatus>("in_attesa");
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setCompany(""); setAgency(""); setRole(""); setStatus("in_attesa"); setLink(""); };

  const importFromLink = async () => {
    if (!link.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-job", { body: { url: link.trim() } });
      if (error) throw error;
      if (data?.company) setCompany(data.company);
      if (data?.role) setRole(data.role);
      toast({ title: "Importato", description: "Dati estratti dall'annuncio." });
    } catch (e: any) {
      toast({ title: "Import non riuscito", description: e.message ?? "Riprova manualmente", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (!company.trim() && !agency.trim()) {
      toast({ title: "Mancano dati", description: "Indica almeno Azienda o Agenzia.", variant: "destructive" });
      return;
    }
    if (!role.trim()) {
      toast({ title: "Mancano dati", description: "Il ruolo è richiesto.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      company: company.trim() || agency.trim(),
      agency: agency.trim() || null,
      role: role.trim(),
      status,
      job_url: link.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvata", description: `${company || agency} • ${role}` });
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-[420px] rounded-2xl border-linen">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Quick Add</DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-editorial text-muted-foreground">
            In meno di 60 secondi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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
            <Label htmlFor="company" className="text-[10px] uppercase tracking-editorial">Azienda *</Label>
            <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-xl" autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-[10px] uppercase tracking-editorial">Ruolo *</Label>
            <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-editorial">Stato</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AppStatus)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving} className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
