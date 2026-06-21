import { User, ShieldCheck, FolderOpen, LogOut, Users, Menu, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { useBranding } from "@/contexts/branding-context";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { currentProject } = useProject();
  const { branding } = useBranding();
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged out successfully" });
      navigate("/login");
    } catch (error) {
      toast({ title: "Logout failed", variant: "destructive" });
    }
  };
  
  return (
    <header className="bg-white shadow-sm border-b border-border-gray">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/projects">
              <div className="flex items-center space-x-4 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 bg-cisco-blue rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {branding.logoDataUrl ? (
                    <img src={branding.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 14l3-3 3 3L20 7v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7l7 7z"/>
                    </svg>
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-medium text-gray-900">{branding.appName}</h1>
                  <p className="text-sm text-gray-500">{branding.appSubtitle}</p>
                </div>
              </div>
            </Link>
            
            {currentProject && location !== "/projects" && (
              <div className="ml-4 border-l border-gray-200 pl-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                  <FolderOpen className="h-4 w-4 text-cisco-blue" />
                  <span className="text-sm font-medium text-cisco-blue" data-testid="text-current-project">
                    {currentProject.name}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Connected
              </div>
            </span>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3 py-1.5" data-testid="button-settings-menu">
                    <div className="flex items-center space-x-2">
                      {isAdmin ? (
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                      ) : (
                        <User className="h-4 w-4 text-gray-600" />
                      )}
                      <span className="text-sm font-medium text-gray-700" data-testid="text-username">
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
                          : user.username}
                      </span>
                      <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                    <Menu className="h-4 w-4 text-gray-400 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuLabel>Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/projects')} data-testid="menu-item-projects">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Projects
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/users')} data-testid="menu-item-users">
                      <Users className="h-4 w-4 mr-2" />
                      Users
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/branding')} data-testid="menu-item-branding">
                      <Palette className="h-4 w-4 mr-2" />
                      Branding
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="menu-item-logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
