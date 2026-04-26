import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Accedi — Regia Carriera";
  }, []);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast({ title: "Account creato", description: "Sei dentro." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      toast({ title: "Errore", description: e.message ?? "Riprova", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex justify-center">
      <main className="w-full max-w-[480px] min-h-dvh flex flex-col bg-paper border-x border-linen px-6 pt-16">
        <header className="mb-12">
          <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-2">Job Search OS</p>
          <h1 className="font-serif text-4xl font-semibold leading-none">Regia Carriera</h1>
          <div className="h-px w-12 bg-foreground mt-6" />
        </header>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] uppercase tracking-editorial">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[10px] uppercase tracking-editorial">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-xl h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "signin" ? "Accedi" : "Crea account")}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground transition text-center"
        >
          {mode === "signin" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </main>
    </div>
  );
}
