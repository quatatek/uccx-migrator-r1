import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FolderInput, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Check,
  Upload,
  FolderSync,
  FolderOpen
} from "lucide-react";
import { useProject } from "@/contexts/project-context";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface ProjectStatistics {
  importedConfigs: number;
  successfulMigrations: number;
  pendingMigrations: number;
  failedMigrations: number;
  skills: number;
  resourceGroups: number;
  resources: number;
  teams: number;
  csqs: number;
  applications: number;
  triggers: number;
  sourceConnections: number;
  destinationConnections: number;
}

interface AuditLog {
  id: string;
  level: string;
  category: string;
  message: string;
  source: string;
  timestamp: string;
}

export default function Dashboard() {
  const { currentProject } = useProject();

  const { data: statistics, isLoading: statsLoading } = useQuery<ProjectStatistics>({
    queryKey: ['/api/projects', currentProject?.id, 'statistics'],
    enabled: !!currentProject?.id,
  });

  const { data: recentLogs, isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: ['/api/logs', 'recent', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const params = new URLSearchParams({ projectId: currentProject.id, limit: '5' });
      const res = await fetch(`/api/logs?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentProject?.id,
  });

  const { data: activeMigrations } = useQuery<any[]>({
    queryKey: ['/api/migrations/active'],
    refetchInterval: 5000,
    enabled: !!currentProject?.id,
  });

  const getActivityIcon = (category: string, level: string) => {
    if (level === 'error') return <AlertTriangle className="h-4 w-4 text-red-600" />;
    
    switch (category) {
      case 'import':
        return <Upload className="h-4 w-4 text-blue-600" />;
      case 'migration':
        return <FolderSync className="h-4 w-4 text-green-600" />;
      default:
        return <Check className="h-4 w-4 text-green-600" />;
    }
  };

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <FolderOpen className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Project Selected</h2>
        <p className="text-gray-500 mb-4">Please select a project to view the dashboard.</p>
        <Link href="/projects">
          <Button data-testid="link-go-to-projects">Go to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-5 w-5 text-cisco-blue" />
          <span className="text-lg font-medium text-gray-700">{currentProject.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <FolderInput className="h-6 w-6 text-cisco-blue" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Imported Configs</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="stat-imported-configs">
                    {statsLoading ? '...' : statistics?.importedConfigs || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Successful Migrations</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="stat-successful-migrations">
                    {statsLoading ? '...' : statistics?.successfulMigrations || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Migrations</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="stat-pending-migrations">
                    {statsLoading ? '...' : statistics?.pendingMigrations || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Migrations</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="stat-failed-migrations">
                    {statsLoading ? '...' : statistics?.failedMigrations || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Skills</span>
                  <span className="font-medium" data-testid="stat-skills">{statsLoading ? '...' : statistics?.skills || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Resource Groups</span>
                  <span className="font-medium" data-testid="stat-resource-groups">{statsLoading ? '...' : statistics?.resourceGroups || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Resources</span>
                  <span className="font-medium" data-testid="stat-resources">{statsLoading ? '...' : statistics?.resources || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Teams</span>
                  <span className="font-medium" data-testid="stat-teams">{statsLoading ? '...' : statistics?.teams || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">CSQs</span>
                  <span className="font-medium" data-testid="stat-csqs">{statsLoading ? '...' : statistics?.csqs || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Applications</span>
                  <span className="font-medium" data-testid="stat-applications">{statsLoading ? '...' : statistics?.applications || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Triggers</span>
                  <span className="font-medium" data-testid="stat-triggers">{statsLoading ? '...' : statistics?.triggers || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Connections</span>
                  <span className="font-medium" data-testid="stat-connections">
                    {statsLoading ? '...' : `${statistics?.sourceConnections || 0} / ${statistics?.destinationConnections || 0}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logsLoading ? (
                  <p className="text-gray-500">Loading recent activity...</p>
                ) : recentLogs && recentLogs.length > 0 ? (
                  recentLogs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {getActivityIcon(log.category, log.level)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{log.message}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Database Status</span>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Operational
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Migration Service</span>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Ready
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Active Jobs</span>
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  {activeMigrations?.length || 0} Running
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">XML Parser</span>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Ready
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
