import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { BiometricGate } from "@/components/BiometricGate";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Applications from "./pages/Applications";
import ApplicationDetail from "./pages/ApplicationDetail";
import Interviews from "./pages/Interviews";
import Courses from "./pages/Courses";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import Archive from "./pages/Archive";
import NotFound from "./pages/NotFound";

const Guarded = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth><BiometricGate>{children}</BiometricGate></RequireAuth>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Guarded><Dashboard /></Guarded>} />
            <Route path="/applications" element={<Guarded><Applications /></Guarded>} />
            <Route path="/applications/:id" element={<Guarded><ApplicationDetail /></Guarded>} />
            <Route path="/interviews" element={<Guarded><Interviews /></Guarded>} />
            <Route path="/courses" element={<Guarded><Courses /></Guarded>} />
            <Route path="/archive" element={<Guarded><Archive /></Guarded>} />
            <Route path="/reports" element={<Guarded><Reports /></Guarded>} />
            <Route path="/profile" element={<Guarded><Profile /></Guarded>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
