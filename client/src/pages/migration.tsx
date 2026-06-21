import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import StatusBadge from "@/components/ui/status-badge";
import { useProject } from "@/contexts/project-context";
import { 
  Server, 
  Rocket, 
  Plus,
  Loader2,
  CheckCircle,
  X,
  AlertTriangle,
  FolderOpen
} from "lucide-react";

interface Configuration {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface UccxConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  isSource: boolean;
  isActive: boolean;
}

interface MigrationJob {
  id: string;
  configurationId: string;
  targetConnectionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  settings?: any;
}

interface ActiveMigration {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  startedAt?: Date;
  error?: string;
}

const CONFIG_TYPES = [
  { value: 'skills',          label: 'Skills' },
  { value: 'resource_groups', label: 'Resource Groups' },
  { value: 'csqs',            label: 'CSQs' },
  { value: 'resources',       label: 'Resources' },
  { value: 'teams',           label: 'Teams' },
  { value: 'applications',    label: 'Applications' },
  { value: 'triggers',        label: 'Triggers' },
];
const ALL_CONFIG_VALUES = CONFIG_TYPES.map(t => t.value);

export default function Migration() {
  const [migrationForm, setMigrationForm] = useState({
    configurationItems: [] as string[],
    targetConnectionId: '',
    migrationType: 'full',
    migrationMode: 'live', // 'live' or 'offline'
    sendNotification: false,
  });

  const toggleConfigItem = (value: string) => {
    setMigrationForm(prev => ({
      ...prev,
      configurationItems: prev.configurationItems.includes(value)
        ? prev.configurationItems.filter(v => v !== value)
        : [...prev.configurationItems, value],
    }));
  };
  
  const [connectionForm, setConnectionForm] = useState({
    host: '',
    port: 443,
    username: '',
    password: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentProject } = useProject();

  // Fetch data
  const { data: configurations } = useQuery<Configuration[]>({
    queryKey: ['/api/configurations'],
  });

  const { data: connections } = useQuery<UccxConnection[]>({
    queryKey: ['/api/connections', { projectId: currentProject?.id }],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const response = await fetch(`/api/connections?projectId=${currentProject.id}`);
      if (!response.ok) throw new Error('Failed to fetch connections');
      return response.json();
    },
    enabled: !!currentProject?.id,
  });

  // Fetch target systems specifically
  const { data: targetSystems } = useQuery<UccxConnection[]>({
    queryKey: ['/api/uccx-connections/target', { projectId: currentProject?.id }],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const response = await fetch(`/api/uccx-connections/target?projectId=${currentProject.id}`);
      if (!response.ok) throw new Error('Failed to fetch target systems');
      return response.json();
    },
    enabled: !!currentProject?.id,
  });

  const { data: activeMigrations, isLoading: migrationsLoading } = useQuery<ActiveMigration[]>({
    queryKey: ['/api/migrations/active'],
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
  });

  const { data: recentMigrations } = useQuery<MigrationJob[]>({
    queryKey: ['/api/migrations', { limit: 10 }],
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!connectionForm.host) {
        throw new Error('Host is required');
      }
      
      // First create a temporary connection to test
      const connectionData = {
        name: `Test_${Date.now()}`,
        host: connectionForm.host,
        port: connectionForm.port,
        username: connectionForm.username,
        password: connectionForm.password,
        isSource: false,
        isActive: false,
      };

      const response = await apiRequest('POST', '/api/connections', connectionData);
      const connection = await response.json();
      
      // Test the connection
      const testResponse = await apiRequest('POST', `/api/connections/${connection.id}/test`);
      return testResponse.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: result.message,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    },
  });

  // Start migration mutation
  const startMigrationMutation = useMutation({
    mutationFn: async () => {
      if (migrationForm.migrationMode === 'offline') {
        // Handle offline migration - generate XML files
        const response = await apiRequest('POST', '/api/migrations/offline', {
          configurationItems: migrationForm.configurationItems,
          targetConnectionId: migrationForm.targetConnectionId,
          projectId: currentProject?.id,
          settings: {
            migrationType: migrationForm.migrationType,
          },
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `migration_files_${Date.now()}.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          return { success: true, type: 'offline' };
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Failed to generate offline migration files');
        }
      } else {
        // Handle live migration
        const migrationData = {
          configurationItems: migrationForm.configurationItems,
          targetConnectionId: migrationForm.targetConnectionId,
          projectId: currentProject?.id,
          settings: {
            migrationType: migrationForm.migrationType,
            sendNotification: migrationForm.sendNotification,
          },
        };

        const response = await apiRequest('POST', '/api/migrations', migrationData);
        return response.json();
      }
    },
    onSuccess: (result) => {
      if (result.type === 'offline') {
        toast({
          title: "Migration Files Generated",
          description: "XML migration files have been downloaded to your computer.",
        });
      } else {
        toast({
          title: "Migration Started",
          description: "Migration job has been queued and will begin shortly.",
        });
      }
      
      // Reset form
      setMigrationForm({
        configurationItems: ALL_CONFIG_VALUES,
        targetConnectionId: '',
        migrationType: 'full',
        migrationMode: 'live',
        sendNotification: false,
      });
      
      // Refresh migration data
      queryClient.invalidateQueries({ queryKey: ['/api/migrations'] });
    },
    onError: (error: any) => {
      const title = migrationForm.migrationMode === 'offline' 
        ? "Failed to Generate Migration Files" 
        : "Migration Failed to Start";
      
      toast({
        title,
        description: error.message || "Failed to process migration request",
        variant: "destructive",
      });
    },
  });

  // Cancel migration mutation
  const cancelMigrationMutation = useMutation({
    mutationFn: async (migrationId: string) => {
      await apiRequest('POST', `/api/migrations/${migrationId}/cancel`);
    },
    onSuccess: () => {
      toast({
        title: "Migration Cancelled",
        description: "Migration job has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/migrations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancel Failed",
        description: error.message || "Failed to cancel migration",
        variant: "destructive",
      });
    },
  });

  const handleFormChange = (field: string, value: any) => {
    setMigrationForm(prev => ({ ...prev, [field]: value }));
  };

  const handleConnectionChange = (field: string, value: any) => {
    setConnectionForm(prev => ({ ...prev, [field]: value }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 text-cisco-blue animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const formatDuration = (startTime?: Date | string) => {
    if (!startTime) return '';
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const sourceConnections = connections?.filter(c => c.isSource) || [];
  const targetConnections = connections?.filter(c => !c.isSource && c.isActive) || [];

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Migration Management</h2>
            <p className="text-sm text-gray-600">Execute and monitor configuration migrations to target UCCX systems</p>
          </div>
        </div>

        {/* Migration Setup */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Target Systems List */}
          <Card>
            <CardHeader>
              <CardTitle>Target UCCX Systems</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {targetSystems && targetSystems.length > 0 ? (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Select Target System</Label>
                  {targetSystems.map((system) => (
                    <div key={system.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="radio"
                        name="targetSystem"
                        value={system.id}
                        checked={migrationForm.targetConnectionId === system.id}
                        onChange={(e) => handleFormChange('targetConnectionId', e.target.value)}
                        className="h-4 w-4 text-cisco-blue focus:ring-cisco-blue border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Server className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{system.name}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {system.host}:{system.port}
                          {system.isActive && (
                            <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                              Active
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-gray-300 rounded-lg">
                  <Server className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Target Systems</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Configure target systems in the Target Systems tab first.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Migration Options */}
          <Card>
            <CardHeader>
              <CardTitle>Migration Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-gray-700">Items to Migrate</Label>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className="text-cisco-blue hover:underline"
                      onClick={() => setMigrationForm(prev => ({ ...prev, configurationItems: ALL_CONFIG_VALUES }))}
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      className="text-cisco-blue hover:underline"
                      onClick={() => setMigrationForm(prev => ({ ...prev, configurationItems: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 border border-gray-200 rounded-md bg-gray-50">
                  {CONFIG_TYPES.map(type => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`config-${type.value}`}
                        checked={migrationForm.configurationItems.includes(type.value)}
                        onCheckedChange={() => toggleConfigItem(type.value)}
                      />
                      <Label htmlFor={`config-${type.value}`} className="text-sm text-gray-700 cursor-pointer font-normal">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {migrationForm.configurationItems.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Select at least one item type to migrate.</p>
                )}
              </div>

              {/* Migration Mode Selection */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">Migration Mode</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    migrationForm.migrationMode === 'live' 
                      ? 'border-cisco-blue bg-cisco-blue/10' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleFormChange('migrationMode', 'live')}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="migrationMode"
                        value="live"
                        checked={migrationForm.migrationMode === 'live'}
                        onChange={(e) => handleFormChange('migrationMode', e.target.value)}
                        className="h-4 w-4 text-cisco-blue focus:ring-cisco-blue border-gray-300"
                      />
                      <div>
                        <Rocket className="h-5 w-5 text-cisco-blue mb-1" />
                        <div className="font-medium text-gray-900">Live Migration</div>
                        <div className="text-xs text-gray-500">Execute directly on target system</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    migrationForm.migrationMode === 'offline' 
                      ? 'border-cisco-blue bg-cisco-blue/10' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleFormChange('migrationMode', 'offline')}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="migrationMode"
                        value="offline"
                        checked={migrationForm.migrationMode === 'offline'}
                        onChange={(e) => handleFormChange('migrationMode', e.target.value)}
                        className="h-4 w-4 text-cisco-blue focus:ring-cisco-blue border-gray-300"
                      />
                      <div>
                        <Server className="h-5 w-5 text-gray-600 mb-1" />
                        <div className="font-medium text-gray-900">Offline Migration</div>
                        <div className="text-xs text-gray-500">Download XML files</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Migration Type</Label>
                <Select value={migrationForm.migrationType} onValueChange={(value) => handleFormChange('migrationType', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Migration</SelectItem>
                    <SelectItem value="incremental">Incremental Update</SelectItem>
                    <SelectItem value="validation">Validation Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Live Migration Options */}
              {migrationForm.migrationMode === 'live' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Live Migration Options</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sendNotification"
                        checked={migrationForm.sendNotification}
                        onCheckedChange={(checked) => handleFormChange('sendNotification', checked)}
                      />
                      <Label htmlFor="sendNotification" className="text-sm font-medium text-gray-700">
                        Send email notification when complete
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Offline Migration Info */}
              {migrationForm.migrationMode === 'offline' && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-200 rounded-full">
                        <Server className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Offline Migration</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        XML files will be generated and downloaded for manual deployment to target systems.
                        Files include individual API calls with target skill ID mapping.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={() => startMigrationMutation.mutate()}
                disabled={migrationForm.configurationItems.length === 0 || !migrationForm.targetConnectionId || startMigrationMutation.isPending}
                className="w-full bg-cisco-blue hover:bg-cisco-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
                data-testid="button-migration-start"
              >
                {startMigrationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {migrationForm.migrationMode === 'offline' ? 'Generating Files...' : 'Starting Migration...'}
                  </>
                ) : (
                  <>
                    {migrationForm.migrationMode === 'offline' ? (
                      <Server className="h-4 w-4 mr-2" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    {migrationForm.migrationMode === 'offline' ? 'Generate XML Files' : 'Start Live Migration'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Active Migrations */}
        <Card>
          <CardHeader>
            <CardTitle>Active Migration Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {migrationsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading active migrations...</div>
            ) : !activeMigrations || activeMigrations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No active migration jobs</div>
            ) : (
              <div className="space-y-4">
                {activeMigrations.map((migration) => (
                  <div key={migration.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(migration.status)}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            Migration Job {migration.id.slice(0, 8)}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {migration.message || `${migration.status.charAt(0).toUpperCase() + migration.status.slice(1)} migration...`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">{migration.progress}%</span>
                        {migration.startedAt && (
                          <p className="text-xs text-gray-500">
                            Duration: {formatDuration(migration.startedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <Progress value={migration.progress} className="mb-3" />
                    
                    <div className="flex justify-between items-center">
                      <StatusBadge status={migration.status} />
                      {migration.status === 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelMigrationMutation.mutate(migration.id)}
                          disabled={cancelMigrationMutation.isPending}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                    
                    {migration.error && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        Error: {migration.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Migration History */}
        {recentMigrations && recentMigrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Migration History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentMigrations.map((migration) => (
                  <div key={migration.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(migration.status)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Migration Job {migration.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {migration.startedAt && formatDuration(migration.startedAt)} - {migration.progress}% complete
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={migration.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
