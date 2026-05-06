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
    <div className="min-h-dvh bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 lg:w-64 shrink-0 bg-paper border-r border-linen sticky top-0 h-dvh">
        <div className="px-6 pt-8 pb-6">
          <p className="font-serif text-xl font-semibold leading-tight">Regia Carriera</p>
          <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mt-1">Job tracker</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                  isActive ? "bg-foreground/10 text-foreground font-medium" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-6 space-y-1 border-t border-linen pt-3">
          <button onClick={() => navigate("/notifications")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} /><span>Notifiche</span>
          </button>
          <button onClick={() => navigate("/profile")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
            <User className="h-[18px] w-[18px]" strokeWidth={1.5} /><span>Profilo</span>
          </button>
          <button onClick={async () => { await signOut(); navigate("/auth"); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} /><span>Esci</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex justify-center min-w-0">
        <div className="w-full max-w-[480px] md:max-w-[1200px] min-h-dvh flex flex-col bg-paper md:bg-transparent border-x border-linen md:border-0 relative">
          {/* Header */}
          <header className="pt-10 md:pt-8 px-6 md:px-10 pb-6">
            <div className="flex justify-between items-end mb-1 gap-4">
              <div className="min-w-0">
                <h1 className="font-serif text-3xl md:text-4xl font-semibold leading-tight truncate">{title}</h1>
                {subtitle && <p className="text-xs uppercase tracking-editorial text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2">
                {action}
                {/* Mobile-only header buttons */}
                <button onClick={() => navigate("/notifications")} aria-label="Notifiche" className="md:hidden p-2 text-muted-foreground hover:text-foreground transition">
                  <Bell className="h-4 w-4" />
                </button>
                <button onClick={() => navigate("/profile")} aria-label="Profilo" className="md:hidden p-2 text-muted-foreground hover:text-foreground transition">
                  <User className="h-4 w-4" />
                </button>
                <button onClick={async () => { await signOut(); navigate("/auth"); }} aria-label="Esci" className="md:hidden p-2 text-muted-foreground hover:text-foreground transition">
                  <LogOut className="h-4 w-4" />
                </button>
                {/* Desktop quick add */}
                <button onClick={() => setQuickOpen(true)} className="hidden md:inline-flex items-center gap-2 bg-foreground text-background rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                  <Plus className="h-4 w-4" strokeWidth={2} /> Nuova candidatura
                </button>
              </div>
            </div>
            <div className="h-px w-full bg-linen mt-4" />
          </header>

          {/* Content */}
          <main className="flex-1 pb-32 md:pb-10 md:px-4">{children}</main>

          {/* Mobile FAB */}
          <button
            onClick={() => setQuickOpen(true)}
            aria-label="Aggiungi candidatura"
            className="md:hidden fixed bottom-24 right-1/2 translate-x-[200px] sm:translate-x-[210px] z-30 size-14 bg-foreground text-background flex items-center justify-center rounded-full shadow-paper hover:bg-accent transition-colors"
          >
            <Plus className="h-6 w-6" strokeWidth={1.5} />
          </button>

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 w-full max-w-[480px] bg-paper/95 backdrop-blur-sm border-t border-linen z-20 safe-bottom rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex justify-between items-end px-4 pt-2 pb-1">
              {tabs.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-1 py-2 px-1 min-w-[52px] min-h-[52px] transition-colors rounded-xl",
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
    </div>
  );
}
