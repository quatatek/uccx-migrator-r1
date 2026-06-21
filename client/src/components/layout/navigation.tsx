import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Gauge, 
  Upload, 
  Database, 
  Rocket, 
  Globe,
  Ligature,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: Gauge },
  { path: "/servers", label: "Servers", icon: Globe },
  { path: "/import", label: "Import Configuration", icon: Upload },
  { path: "/configurations", label: "Configurations", icon: Database },
  { path: "/migration", label: "Migration", icon: Rocket },
  { path: "/logs", label: "Logs & Audit", icon: Ligature },
];

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="flex items-center mb-6">
      <div className="flex space-x-1" role="tablist">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
          
          return (
            <Link key={item.path} href={item.path}>
              <button 
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                  isActive 
                    ? "text-cisco-blue bg-blue-50 border-b-2 border-cisco-blue"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
                role="tab" 
                aria-selected={isActive}
                data-testid={`nav-${item.path.slice(1) || 'dashboard'}`}
              >
                <Icon className="w-4 h-4 mr-2 inline" />
                {item.label}
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
