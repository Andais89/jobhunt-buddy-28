import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { biometricEnabledForUser, isUnlockedThisSession, verifyBiometric } from "@/lib/biometric";
import { Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BiometricGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(isUnlockedThisSession());
  const [busy, setBusy] = useState(false);
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const required = biometricEnabledForUser(user.id) && !isUnlockedThisSession();
    setNeeded(required);
    if (required) tryUnlock();
    else setUnlocked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const tryUnlock = async () => {
    setBusy(true);
    const ok = await verifyBiometric();
    setBusy(false);
    if (ok) setUnlocked(true);
  };

  if (loading || !user || unlocked || !needed) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] flex flex-col items-center text-center">
        <div className="size-16 rounded-2xl bg-foreground/5 flex items-center justify-center mb-6">
          <Fingerprint className="h-8 w-8" strokeWidth={1.4} />
        </div>
        <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-2">Sblocco rapido</p>
        <h2 className="font-serif text-2xl font-semibold mb-2">Sblocca con Face ID</h2>
        <p className="text-sm text-muted-foreground mb-8">Conferma la tua identità per accedere alle candidature.</p>
        <Button onClick={tryUnlock} disabled={busy} className="w-full rounded-xl h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sblocca"}
        </Button>
      </div>
    </div>
  );
}
