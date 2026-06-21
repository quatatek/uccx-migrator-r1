import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ProjectProvider } from "@/contexts/project-context";
import { BrandingProvider } from "@/contexts/branding-context";
import { ProtectedRoute } from "@/components/protected-route";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Import from "@/pages/import";
import Configurations from "@/pages/configurations";
import Migration from "@/pages/migration";
import Skills from "@/pages/skills";
import ResourceGroups from "@/pages/resource-groups";
import CSQs from "@/pages/csqs";
import Resources from "@/pages/resources";
import Teams from "@/pages/teams";
import Applications from "@/pages/applications";
import Triggers from "@/pages/triggers";
import Servers from "@/pages/servers";
import TargetSystems from "@/pages/target-systems";
import Users from "@/pages/users";
import Logs from "@/pages/logs";
import Branding from "@/pages/branding";
import Projects from "@/pages/projects";
import NotFound from "@/pages/not-found";
import Header from "@/components/layout/header";
import Navigation from "@/components/layout/navigation";

function ProtectedLayout({ children, showNavigation = true }: { children: React.ReactNode; showNavigation?: boolean }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-surface-gray">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-6">
          {showNavigation && <Navigation />}
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      </Route>
      <Route path="/dashboard">
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      </Route>
      <Route path="/import">
        <ProtectedLayout><Import /></ProtectedLayout>
      </Route>
      <Route path="/configurations">
        <ProtectedLayout><Configurations /></ProtectedLayout>
      </Route>
      <Route path="/migration">
        <ProtectedLayout><Migration /></ProtectedLayout>
      </Route>
      <Route path="/skills">
        <ProtectedLayout><Skills /></ProtectedLayout>
      </Route>
      <Route path="/resource-groups">
        <ProtectedLayout><ResourceGroups /></ProtectedLayout>
      </Route>
      <Route path="/csqs">
        <ProtectedLayout><CSQs /></ProtectedLayout>
      </Route>
      <Route path="/resources">
        <ProtectedLayout><Resources /></ProtectedLayout>
      </Route>
      <Route path="/teams">
        <ProtectedLayout><Teams /></ProtectedLayout>
      </Route>
      <Route path="/applications">
        <ProtectedLayout><Applications /></ProtectedLayout>
      </Route>
      <Route path="/triggers">
        <ProtectedLayout><Triggers /></ProtectedLayout>
      </Route>
      <Route path="/configurations/skills">
        <ProtectedLayout><Skills /></ProtectedLayout>
      </Route>
      <Route path="/configurations/resource-groups">
        <ProtectedLayout><ResourceGroups /></ProtectedLayout>
      </Route>
      <Route path="/configurations/csqs">
        <ProtectedLayout><CSQs /></ProtectedLayout>
      </Route>
      <Route path="/configurations/resources">
        <ProtectedLayout><Resources /></ProtectedLayout>
      </Route>
      <Route path="/configurations/teams">
        <ProtectedLayout><Teams /></ProtectedLayout>
      </Route>
      <Route path="/configurations/applications">
        <ProtectedLayout><Applications /></ProtectedLayout>
      </Route>
      <Route path="/configurations/triggers">
        <ProtectedLayout><Triggers /></ProtectedLayout>
      </Route>
      <Route path="/servers">
        <ProtectedLayout><Servers /></ProtectedLayout>
      </Route>
      <Route path="/target-systems">
        <ProtectedLayout><TargetSystems /></ProtectedLayout>
      </Route>
      <Route path="/users">
        <ProtectedRoute requireAdmin>
          <ProtectedLayout><Users /></ProtectedLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/branding">
        <ProtectedRoute requireAdmin>
          <ProtectedLayout showNavigation={false}><Branding /></ProtectedLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/logs">
        <ProtectedLayout><Logs /></ProtectedLayout>
      </Route>
      <Route path="/projects">
        <ProtectedLayout showNavigation={false}><Projects /></ProtectedLayout>
      </Route>
      <Route>
        <ProtectedLayout><NotFound /></ProtectedLayout>
      </Route>
    </Switch>
  );
}

function AuthenticatedProjectProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <>{children}</>;
  }
  
  return <ProjectProvider>{children}</ProjectProvider>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrandingProvider>
          <TooltipProvider>
            <Toaster />
            <AuthenticatedProjectProvider>
              <Router />
            </AuthenticatedProjectProvider>
          </TooltipProvider>
        </BrandingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
