import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, Archive, GraduationCap, BarChart3, Plus, LogOut, User, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { QuickAddDialog } from "@/components/QuickAddDialog";

const tabs = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/applications", label: "Candidature", Icon: Briefcase },
  { to: "/archive", label: "Archivio", Icon: Archive },
  { to: "/courses", label: "Corsi", Icon: GraduationCap },
  { to: "/reports", label: "Report", Icon: BarChart3 },
];

export function MobileShell({ children, title, subtitle, action }: {
  children: ReactNode; title: string; subtitle?: string; action?: ReactNode;
}) {
  const [quickOpen, setQuickOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  

  return (
    <div className="min-h-dvh bg-background flex justify-center">
      <div className="w-full max-w-[480px] min-h-dvh flex flex-col bg-paper border-x border-linen relative">
        {/* Header */}
        <header className="pt-10 px-6 pb-6">
          <div className="flex justify-between items-end mb-1">
            <div>
              <h1 className="font-serif text-3xl font-semibold leading-tight">{title}</h1>
              {subtitle && <p className="text-xs uppercase tracking-editorial text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {action}
              <button
                onClick={() => navigate("/notifications")}
                aria-label="Notifiche"
                className="p-2 text-muted-foreground hover:text-foreground transition"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/profile")}
                aria-label="Profilo"
                className="p-2 text-muted-foreground hover:text-foreground transition"
              >
                <User className="h-4 w-4" />
              </button>
              <button
                onClick={async () => { await signOut(); navigate("/auth"); }}
                aria-label="Esci"
                className="p-2 text-muted-foreground hover:text-foreground transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="h-px w-full bg-linen mt-4" />
        </header>

        {/* Content */}
        <main className="flex-1 pb-32">{children}</main>

        {/* FAB */}
        <button
          onClick={() => setQuickOpen(true)}
          aria-label="Aggiungi candidatura"
          className="fixed bottom-24 right-1/2 translate-x-[200px] sm:translate-x-[210px] z-30 size-14 bg-foreground text-background flex items-center justify-center rounded-full shadow-paper hover:bg-accent transition-colors"
        >
          <Plus className="h-6 w-6" strokeWidth={1.5} />
        </button>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 w-full max-w-[480px] bg-paper/95 backdrop-blur-sm border-t border-linen z-20 safe-bottom rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex justify-between items-end px-4 pt-2 pb-1">
            {tabs.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2 px-1 min-w-[52px] transition-colors rounded-xl",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={cn("p-1.5 rounded-xl transition-colors", isActive ? "bg-foreground/10" : "bg-transparent")}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    </div>
                    <span className="text-[8px] uppercase tracking-editorial font-semibold leading-none">{label}</span>
                    <div className={cn("h-1 w-1 rounded-full mt-0.5", isActive ? "bg-foreground" : "bg-transparent")} />
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <QuickAddDialog open={quickOpen} onOpenChange={setQuickOpen} />
      </div>
    </div>
  );
}
