import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth-token";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Search, 
  Trash2, 
  Eye, 
  Edit,
  Save,
  X,
  ArrowLeft,
  Users,
  Upload,
  CheckCircle,
  AlertCircle,
  Settings,
  Play,
  FileText,
  Code,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useProjectApi } from "@/hooks/use-project-api";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Team } from "@shared/schema";

function XmlDisplay({ id, type, projectId }: { id: number | string; type: string; projectId: string | null }) {
  const [xmlContent, setXmlContent] = useState<string>('Loading...');

  useEffect(() => {
    const fetchXml = async () => {
      try {
        const url = projectId ? `/api/${type}/${id}/xml?projectId=${projectId}` : `/api/${type}/${id}/xml`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        setXmlContent(response.ok ? await response.text() : 'No XML data available');
      } catch {
        setXmlContent('Error loading XML');
      }
    };
    fetchXml();
  }, [id, type, projectId]);

  return <>{xmlContent}</>;
}

export default function TeamsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);
  const [targetConnectionId, setTargetConnectionId] = useState("");
  const [migrationOptions, setMigrationOptions] = useState({
    dryRun: false,
    createBackup: true,
    overrideExisting: false,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentProjectId, hasProject, projectFetch, getProjectUrl } = useProjectApi();

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['/api/teams', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/teams'),
    enabled: hasProject,
  });

  const { data: targetSystems = [] } = useQuery({
    queryKey: ['/api/uccx-connections/target', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/uccx-connections/target'),
    enabled: hasProject,
  });

  const { data: activeMigrations = [] } = useQuery<any[]>({
    queryKey: ['/api/migrations/active', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/migrations/active'),
    enabled: hasProject,
    refetchInterval: 2000,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['/api/teams', selectedTeam?.id, 'resources', { projectId: currentProjectId }],
    queryFn: async () => {
      if (!selectedTeam?.id) return [];
      return projectFetch(`/api/teams/${selectedTeam.id}/resources`);
    },
    enabled: !!selectedTeam?.id && hasProject,
  });

  const { data: primarySupervisor } = useQuery({
    queryKey: ['/api/resources/userID', selectedTeam?.primarySupervisorUserID, { projectId: currentProjectId }],
    queryFn: async () => {
      if (!selectedTeam?.primarySupervisorUserID) return null;
      const resources = await projectFetch('/api/resources');
      return resources.find((r: any) => r.userID === selectedTeam.primarySupervisorUserID);
    },
    enabled: !!selectedTeam?.primarySupervisorUserID && hasProject,
  });

  if (!hasProject) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a project from the header menu to view and manage teams.
        </p>
      </div>
    );
  }

  const updateMutation = useMutation({
    mutationFn: async ({ teamId, teamname }: { teamId: string; teamname: string }) => {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ teamname, projectId: currentProjectId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setEditingTeam(null);
      setEditingName("");
      queryClient.invalidateQueries({ queryKey: ['/api/teams', { projectId: currentProjectId }] });
      toast({
        title: "Team Updated",
        description: "Team name has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update team",
        variant: "destructive",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await fetch(`/api/teams/${teamId}?projectId=${currentProjectId}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', { projectId: currentProjectId }] });
      toast({
        title: "Team Deleted",
        description: "Team has been removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete team",
        variant: "destructive",
      });
    },
  });

  const startEditing = (team: Team) => {
    setEditingTeam(team.id);
    setEditingName(team.teamname);
  };

  const cancelEditing = () => {
    setEditingTeam(null);
    setEditingName("");
  };

  const saveTeamName = (teamId: string) => {
    if (!editingName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Team name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ teamId, teamname: editingName.trim() });
  };

  const toggleTeamSelection = (teamId: string) => {
    const newSelection = new Set(selectedTeams);
    if (newSelection.has(teamId)) {
      newSelection.delete(teamId);
    } else {
      newSelection.add(teamId);
    }
    setSelectedTeams(newSelection);
  };

  const selectAllTeams = () => {
    setSelectedTeams(new Set(filteredTeams.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedTeams(new Set());
  };

  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!targetConnectionId) {
        throw new Error('Target system is required');
      }

      const selectedTeamData = teams.filter(t => selectedTeams.has(t.id));
      
      const migrationJob = {
        configurationId: null,
        targetConnectionId,
        status: 'pending' as const,
        progress: 0,
        projectId: currentProjectId,
        settings: {
          type: 'teams',
          teams: selectedTeamData,
          options: migrationOptions,
        },
      };

      const response = await apiRequest('POST', '/api/migrations', migrationJob);
      return response.json();
    },
    onSuccess: () => {
      setShowProvisionDialog(false);
      setSelectedTeams(new Set());
      setTargetConnectionId("");
      queryClient.invalidateQueries({ queryKey: ['/api/migrations/active', { projectId: currentProjectId }] });
      toast({
        title: "Migration Started",
        description: `Started provisioning ${selectedTeams.size} teams to target system.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Provisioning Failed",
        description: error instanceof Error ? error.message : "Failed to start migration",
        variant: "destructive",
      });
    },
  });

  const filteredTeams = teams.filter(team => 
    team.teamname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/configurations">
              <Button variant="ghost" size="sm" className="flex items-center space-x-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Configurations</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-800" />
                </div>
                <span>Teams Management</span>
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage imported UCCX teams. To import new teams, use the main Import tab.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <Users className="h-6 w-6 text-blue-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600" data-testid="text-total-teams-label">Total Teams</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-total-teams">
                    {isLoading ? '...' : teams.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <Search className="h-6 w-6 text-green-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600" data-testid="text-filtered-label">Filtered Results</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-filtered-results">
                    {isLoading ? '...' : filteredTeams.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                  <Edit className="h-6 w-6 text-purple-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600" data-testid="text-editable-label">Editable</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-editable">Yes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {filteredTeams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Bulk Provision</span>
              </CardTitle>
              <CardDescription>
                Select teams to provision to target UCCX systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllTeams}
                    disabled={selectedTeams.size === filteredTeams.length}
                    data-testid="button-select-all"
                  >
                    Select All ({filteredTeams.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedTeams.size === 0}
                    data-testid="button-clear-selection"
                  >
                    Clear Selection
                  </Button>
                  {selectedTeams.size > 0 && (
                    <Badge variant="secondary" className="px-3 py-1" data-testid="badge-selected-count">
                      {selectedTeams.size} selected
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => setShowProvisionDialog(true)}
                  disabled={selectedTeams.size === 0 || targetSystems.length === 0}
                  className="flex items-center space-x-2"
                  data-testid="button-provision-teams"
                >
                  <Play className="h-4 w-4" />
                  <span>Provision Selected</span>
                </Button>
              </div>
              {targetSystems.length === 0 && (
                <p className="text-sm text-amber-600 mt-2" data-testid="text-no-target-systems">
                  No target systems configured. Configure target systems first to enable provisioning.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Teams Overview</CardTitle>
            <CardDescription>
              View and manage all teams in the system
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
                data-testid="input-search"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground" data-testid="text-loading">Loading teams...</div>
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground" data-testid="text-no-teams">
                  {searchTerm ? "No teams found matching your search." : "No teams found."}
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTeams.has(team.id)}
                          onCheckedChange={() => toggleTeamSelection(team.id)}
                          data-testid={`checkbox-team-${team.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <Badge variant="outline" data-testid={`badge-team-id-${team.id}`}>{team.teamId}</Badge>
                          {(team as any).targetTeamId && (
                            <div className="text-xs text-green-600" data-testid={`text-target-team-id-${team.id}`}>
                              → Target: {(team as any).targetTeamId}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingTeam === team.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8"
                              data-testid={`input-edit-name-${team.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => saveTeamName(team.id)}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-${team.id}`}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                              data-testid={`button-cancel-${team.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span data-testid={`text-team-name-${team.id}`}>{team.teamname}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {team.sourceConnectionId ? (
                          <Badge variant="outline" data-testid={`badge-source-${team.id}`}>API</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-source-${team.id}`}>Import</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span data-testid={`text-imported-date-${team.id}`}>
                          {new Date(team.importedAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTeam(team)}
                            data-testid={`button-view-${team.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(team)}
                            data-testid={`button-edit-${team.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" data-testid={`button-delete-${team.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Team</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the team "{team.teamname}"?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid={`button-cancel-delete-${team.id}`}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTeamMutation.mutate(team.id)}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                  data-testid={`button-confirm-delete-${team.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        <Dialog open={!!selectedTeam} onOpenChange={() => setSelectedTeam(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Team Details — {selectedTeam?.teamname}</DialogTitle>
              <DialogDescription>View detailed information and raw XML for this team</DialogDescription>
            </DialogHeader>
            {selectedTeam && (
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="xml">Raw XML</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Team ID</Label>
                        <p className="text-sm text-muted-foreground" data-testid="dialog-team-id">{selectedTeam.teamId}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Name</Label>
                        <p className="text-sm text-muted-foreground" data-testid="dialog-team-name">{selectedTeam.teamname}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Primary Supervisor</Label>
                        <p className="text-sm text-muted-foreground" data-testid="dialog-supervisor">
                          {primarySupervisor ? `${primarySupervisor.firstName || ''} ${primarySupervisor.lastName || ''} (${primarySupervisor.userID})` : selectedTeam.primarySupervisorUserID || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Source</Label>
                        <Badge variant={selectedTeam.sourceConnectionId ? "outline" : "secondary"}>
                          {selectedTeam.sourceConnectionId ? "API" : "XML Import"}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Imported At</Label>
                        <p className="text-sm text-muted-foreground">{new Date(selectedTeam.importedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {teamMembers.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Team Members ({teamMembers.length})</Label>
                        <div className="mt-2 space-y-1">
                          {teamMembers.map((member: any) => (
                            <div key={member.id} className="text-sm text-muted-foreground flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {member.firstName || ''} {member.lastName || ''} ({member.userID})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="xml">
                  <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                    <XmlDisplay id={selectedTeam.id} type="teams" projectId={currentProjectId} />
                  </pre>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {activeMigrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 animate-spin" />
                <span>Active Migrations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeMigrations.map((migration: any) => (
                  <div key={migration.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={migration.status === 'running' ? 'default' : 'secondary'}>
                          {migration.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          {migration.settings?.type === 'teams' ? 'Teams Migration' : 'Migration'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {migration.progress}% complete
                      </span>
                    </div>
                    <Progress value={migration.progress} className="mb-2" />
                    <p className="text-xs text-gray-600">
                      Target: {migration.targetConnectionName || 'Unknown'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Provision Teams to Target System</DialogTitle>
              <DialogDescription>
                Configure the target system for {selectedTeams.size} selected teams.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="target-system">Target UCCX System</Label>
                <Select value={targetConnectionId} onValueChange={setTargetConnectionId}>
                  <SelectTrigger id="target-system" data-testid="select-target-system">
                    <SelectValue placeholder="Select target system" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetSystems.map((system: any) => (
                      <SelectItem key={system.id} value={system.id}>{system.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label>Migration Options</Label>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dry-run" className="text-sm font-normal">Dry Run</Label>
                  <Switch
                    id="dry-run"
                    checked={migrationOptions.dryRun}
                    onCheckedChange={(checked) => setMigrationOptions({ ...migrationOptions, dryRun: checked })}
                    data-testid="switch-dry-run"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-backup" className="text-sm font-normal">Create Backup</Label>
                  <Switch
                    id="create-backup"
                    checked={migrationOptions.createBackup}
                    onCheckedChange={(checked) => setMigrationOptions({ ...migrationOptions, createBackup: checked })}
                    data-testid="switch-create-backup"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="override-existing" className="text-sm font-normal">Override Existing</Label>
                  <Switch
                    id="override-existing"
                    checked={migrationOptions.overrideExisting}
                    onCheckedChange={(checked) => setMigrationOptions({ ...migrationOptions, overrideExisting: checked })}
                    data-testid="switch-override-existing"
                  />
                </div>
              </div>
              <Button
                onClick={() => provisionMutation.mutate()}
                disabled={!targetConnectionId || provisionMutation.isPending}
                className="w-full"
                data-testid="button-start-migration"
              >
                {provisionMutation.isPending ? "Starting..." : "Start Migration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
