import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import { 
  Settings, 
  Users, 
  List, 
  Database,
  ArrowRight,
  Wrench,
  UserCog,
  UsersRound,
  Code,
  Phone,
  Trash2,
  FolderOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useProjectApi } from "@/hooks/use-project-api";

interface ConfigurationStats {
  skills: number;
  resource_groups: number;
  resources: number;
  teams: number;
  agents: number;
  csqs: number;
  applications: number;
  triggers: number;
  devices: number;
  total: number;
}

const configurationTypes = [
  {
    id: 'skills',
    name: 'Skills',
    description: 'Contact center skills and competencies',
    icon: Wrench,
    color: 'bg-blue-100 text-blue-800',
    route: '/configurations/skills'
  },
  {
    id: 'resource_groups',
    name: 'Resource Groups',
    description: 'Resource groups for agent organization',
    icon: Users,
    color: 'bg-teal-100 text-teal-800',
    route: '/configurations/resource-groups'
  },
  {
    id: 'resources',
    name: 'Resources',
    description: 'UCCX resources and user assignments',
    icon: UserCog,
    color: 'bg-indigo-100 text-indigo-800',
    route: '/configurations/resources'
  },
  {
    id: 'teams',
    name: 'Teams',
    description: 'Resource teams and team management',
    icon: UsersRound,
    color: 'bg-cyan-100 text-cyan-800',
    route: '/configurations/teams'
  },
  {
    id: 'csqs',
    name: 'Contact Service Queues',
    description: 'Customer service queues and routing',
    icon: List,
    color: 'bg-purple-100 text-purple-800',
    route: '/configurations/csqs'
  },
  {
    id: 'applications',
    name: 'Applications',
    description: 'UCCX applications and call flows',
    icon: Code,
    color: 'bg-purple-100 text-purple-800',
    route: '/configurations/applications'
  },
  {
    id: 'triggers',
    name: 'Triggers',
    description: 'CTI triggers and directory numbers',
    icon: Phone,
    color: 'bg-orange-100 text-orange-800',
    route: '/configurations/triggers'
  },
];

export default function Configurations() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentProjectId, hasProject, projectFetch, projectRequest } = useProjectApi();

  const { data: configStats, isLoading } = useQuery<ConfigurationStats>({
    queryKey: ['/api/configurations/stats', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/configurations/stats'),
    enabled: hasProject,
  });

  const resetDbMutation = useMutation({
    mutationFn: async () => {
      return await projectRequest('POST', '/api/configurations/reset');
    },
    onSuccess: () => {
      toast({
        title: "Database Reset Successful",
        description: "All configuration data has been deleted.",
      });
      setShowResetDialog(false);
      
      // Invalidate all configuration queries including stats
      queryClient.invalidateQueries({ queryKey: ['/api/configurations/stats', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/configurations', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/skills', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/resource-groups', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/csqs', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/resources', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications', { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ['/api/triggers', { projectId: currentProjectId }] });
    },
    onError: (error: any) => {
      toast({
        title: "Database Reset Failed",
        description: error.message || "Failed to reset database",
        variant: "destructive",
      });
    },
  });

  if (!hasProject) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a project from the header menu to view and manage configurations.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuration Management</h1>
          <p className="text-gray-600 mt-2">
            Manage your UCCX configuration objects. Click on any type to view and edit configurations.
          </p>
        </div>

        {/* Configuration Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configurationTypes.map((configType) => {
            const Icon = configType.icon;
            const count = configStats?.[configType.id as keyof ConfigurationStats] || 0;
            
            return (
              <Link key={configType.id} href={configType.route}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-cisco-blue">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${configType.color.replace('text-', 'text-').replace('bg-', 'bg-')}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold">{configType.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {isLoading ? '...' : count} {count === 1 ? 'item' : 'items'}
                          </Badge>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-cisco-blue transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{configType.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {configurationTypes.map((configType) => {
                const Icon = configType.icon;
                const count = configStats?.[configType.id as keyof ConfigurationStats] || 0;
                
                return (
                  <div key={configType.id} className="text-center">
                    <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center mb-2 ${configType.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{isLoading ? '...' : count}</div>
                    <div className="text-xs text-gray-600">{configType.name}</div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <div className="text-center">
                <div className="text-3xl font-bold text-cisco-blue">
                  {isLoading ? '...' : configStats?.total || 0}
                </div>
                <div className="text-sm text-gray-600">Total Configuration Objects</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Reset Section */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center">
              <Trash2 className="h-5 w-5 mr-2" />
              Database Reset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Clear all configuration data from the database for a fresh start. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              data-testid="button-reset-database"
              onClick={() => setShowResetDialog(true)}
              disabled={resetDbMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {resetDbMutation.isPending ? "Resetting..." : "Reset Database"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all configuration data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Skills</li>
                <li>Resource Groups</li>
                <li>CSQs</li>
                <li>Resources</li>
                <li>Teams</li>
                <li>Applications</li>
                <li>Triggers</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-reset"
              onClick={() => resetDbMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, reset database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}