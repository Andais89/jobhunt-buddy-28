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
import {
  pushSupported, pushPermission, pushEnabled,
  enablePush, disablePush, isStandalone,
} from "@/lib/notifications";
import { Fingerprint, Info, Bell } from "lucide-react";

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

  useEffect(() => {
    document.title = "Profilo — Regia Carriera";
    biometricAvailable().then(setAvailable);
    if (user) setEnabled(biometricEnabledForUser(user.id));
    setPushOn(pushEnabled());
    setPushPerm(pushPermission());
  }, [user]);

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
