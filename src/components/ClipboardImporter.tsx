import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { QuickAddDialog } from "@/components/QuickAddDialog";

const SUPPORTED_PATTERNS = [
  /indeed\./i, /linkedin\.com/i, /infojobs\./i, /gigroup\./i,
  /adecco\./i, /randstad\./i, /monster\./i, /jooble\./i,
  /manpower\./i, /umana\./i, /synergie/i, /lavoropiu/i,
];
const LAST_KEY = "clipboard.lastImportedUrl";
const DISMISSED_KEY = "clipboard.dismissedUrl";
const SESSION_CHECKED_KEY = "clipboard.sessionChecked";

function isJobUrl(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length > 800) return null;
  try {
    const url = new URL(trimmed);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (SUPPORTED_PATTERNS.some(p => p.test(url.hostname))) return url.toString();
    return null;
  } catch {
    return null;
  }
}

export function ClipboardImporter() {
  const [detected, setDetected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [autoImport, setAutoImport] = useState(false);

  const checkClipboard = async () => {
    if (!navigator.clipboard?.readText) return;
    if (document.visibilityState !== "visible") return;
    if (sessionStorage.getItem(SESSION_CHECKED_KEY)) return;
    try {
      const text = await navigator.clipboard.readText();
      const url = isJobUrl(text);
      if (!url) return;
      const last = localStorage.getItem(LAST_KEY);
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (url === last || url === dismissed) return;
      sessionStorage.setItem(SESSION_CHECKED_KEY, "1");
      setDetected(url);
    } catch {
      // permission denied / not focused — silent
    }
  };

  useEffect(() => {
    // Check at mount and whenever the tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === "visible") checkClipboard();
    };
    // Defer first read to next tick so it runs after focus is acquired
    setTimeout(checkClipboard, 400);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkClipboard);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkClipboard);
    };
  }, []);

  if (!detected && !open) return null;

  const sourceName = (() => {
    try { return new URL(detected ?? "").hostname.replace(/^www\./, ""); } catch { return "annuncio"; }
  })();

  const accept = () => {
    if (!detected) return;
    localStorage.setItem(LAST_KEY, detected);
    setAutoImport(true);
    setOpen(true);
  };

  const dismiss = () => {
    if (detected) localStorage.setItem(DISMISSED_KEY, detected);
    setDetected(null);
  };

  return (
    <>
      {detected && !open && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[440px]">
          <div className="bg-foreground text-background rounded-2xl shadow-paper p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="size-9 rounded-xl bg-background/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-editorial font-semibold opacity-70">Link negli appunti</p>
              <p className="text-sm">Abbiamo trovato un link negli appunti — Vuoi importare questo annuncio?</p>
              <p className="text-[11px] opacity-60 truncate mt-0.5">{sourceName}</p>
            </div>
            <button
              onClick={accept}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-background text-foreground text-[11px] uppercase tracking-editorial font-semibold"
            >
              Importa
            </button>
            <button onClick={dismiss} aria-label="Ignora" className="shrink-0 p-1.5 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <QuickAddDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) { setDetected(null); setAutoImport(false); }
        }}
        initialLink={detected ?? undefined}
        autoImport={autoImport}
      />
    </>
  );
}
