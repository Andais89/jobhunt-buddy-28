import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  biometricAvailable,
  biometricEnvSupported,
  biometricEnabledForUser,
  enableBiometric,
  disableBiometric,
} from "@/lib/biometric";
import { Fingerprint, Info } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Profilo — Regia Carriera";
    biometricAvailable().then(setAvailable);
    if (user) setEnabled(biometricEnabledForUser(user.id));
  }, [user]);

  const toggle = async (next: boolean) => {
    if (!user) return;
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
      toast({ title: "Operazione annullata", description: e.message ?? "Riprova", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

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
                  : "Non disponibile su questo dispositivo o browser."}
              </p>
            </div>
            <Switch checked={enabled} disabled={!available || busy} onCheckedChange={toggle} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Per usare Face ID su iPhone, installa l'app sulla schermata Home (Condividi → Aggiungi a Home).
          </p>
        </section>
      </div>
    </MobileShell>
  );
}
