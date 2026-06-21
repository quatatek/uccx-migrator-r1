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
import type { Resource } from "@shared/schema";

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

export default function ResourcesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [editingResource, setEditingResource] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState({
    userID: "",
    firstName: "",
    lastName: "",
  });
  
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
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

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ['/api/resources', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/resources'),
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

  if (!hasProject) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a project from the header menu to view and manage resources.
        </p>
      </div>
    );
  }

  const updateMutation = useMutation({
    mutationFn: async ({ id, userID, firstName, lastName }: { id: string; userID: string; firstName: string; lastName: string }) => {
      const response = await fetch(`/api/resources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userID, firstName, lastName, projectId: currentProjectId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setEditingResource(null);
      setEditingFields({ userID: "", firstName: "", lastName: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/resources', { projectId: currentProjectId }] });
      toast({
        title: "Resource Updated",
        description: "Resource has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update resource",
        variant: "destructive",
      });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const response = await fetch(`/api/resources/${resourceId}?projectId=${currentProjectId}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources', { projectId: currentProjectId }] });
      toast({
        title: "Resource Deleted",
        description: "Resource has been removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete resource",
        variant: "destructive",
      });
    },
  });

  const startEditing = (resource: Resource) => {
    setEditingResource(resource.id);
    setEditingFields({
      userID: resource.userID,
      firstName: resource.firstName || "",
      lastName: resource.lastName || "",
    });
  };

  const cancelEditing = () => {
    setEditingResource(null);
    setEditingFields({ userID: "", firstName: "", lastName: "" });
  };

  const saveResource = (resourceId: string) => {
    if (!editingFields.userID.trim()) {
      toast({
        title: "Invalid User ID",
        description: "User ID cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ 
      id: resourceId, 
      userID: editingFields.userID.trim(),
      firstName: editingFields.firstName.trim(),
      lastName: editingFields.lastName.trim(),
    });
  };

  const toggleResourceSelection = (resourceId: string) => {
    const newSelection = new Set(selectedResources);
    if (newSelection.has(resourceId)) {
      newSelection.delete(resourceId);
    } else {
      newSelection.add(resourceId);
    }
    setSelectedResources(newSelection);
  };

  const selectAllResources = () => {
    setSelectedResources(new Set(filteredResources.map(r => r.id)));
  };

  const clearSelection = () => {
    setSelectedResources(new Set());
  };

  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!targetConnectionId) {
        throw new Error('Target system is required');
      }

      const selectedResourceData = resources.filter(r => selectedResources.has(r.id));
      
      const migrationJob = {
        configurationId: null,
        targetConnectionId,
        status: 'pending' as const,
        progress: 0,
        projectId: currentProjectId,
        settings: {
          type: 'resources',
          resources: selectedResourceData,
          options: migrationOptions,
        },
      };

      const response = await apiRequest('POST', '/api/migrations', migrationJob);
      return response.json();
    },
    onSuccess: () => {
      setShowProvisionDialog(false);
      setSelectedResources(new Set());
      setTargetConnectionId("");
      queryClient.invalidateQueries({ queryKey: ['/api/migrations/active', { projectId: currentProjectId }] });
      toast({
        title: "Migration Started",
        description: `Started provisioning ${selectedResources.size} resources to target system.`,
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

  const filteredResources = resources.filter(resource => {
    const searchLower = searchTerm.toLowerCase();
    return (
      resource.userID.toLowerCase().includes(searchLower) ||
      (resource.firstName?.toLowerCase() || "").includes(searchLower) ||
      (resource.lastName?.toLowerCase() || "").includes(searchLower)
    );
  });

  const provisionedCount = resources.filter(r => r.targetUserID).length;

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
                <span>Resources Management</span>
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage imported UCCX resources. To import new resources, use the main Import tab.
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
                  <p className="text-sm font-medium text-gray-600" data-testid="text-total-label">Total Resources</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-total-count">
                    {isLoading ? '...' : resources.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <Upload className="h-6 w-6 text-green-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600" data-testid="text-imported-label">Imported</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-imported-count">
                    {isLoading ? '...' : resources.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                  <CheckCircle className="h-6 w-6 text-purple-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600" data-testid="text-provisioned-label">Provisioned</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-provisioned-count">
                    {isLoading ? '...' : provisionedCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedResources.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Bulk Provision</span>
              </CardTitle>
              <CardDescription>
                Select resources to provision to target UCCX systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllResources}
                    disabled={selectedResources.size === filteredResources.length}
                    data-testid="button-select-all"
                  >
                    Select All ({filteredResources.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedResources.size === 0}
                    data-testid="button-clear-selection"
                  >
                    Clear Selection
                  </Button>
                  {selectedResources.size > 0 && (
                    <Badge variant="secondary" className="px-3 py-1" data-testid="badge-selected-count">
                      {selectedResources.size} selected
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => setShowProvisionDialog(true)}
                  disabled={selectedResources.size === 0 || targetSystems.length === 0}
                  className="flex items-center space-x-2"
                  data-testid="button-provision-resources"
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
            <CardTitle>Resources Overview</CardTitle>
            <CardDescription>
              View and manage all resources in the system
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
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
                <div className="text-muted-foreground" data-testid="text-loading">Loading resources...</div>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground" data-testid="text-no-resources">
                  {searchTerm ? "No resources found matching your search." : "No resources found."}
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResources.map((resource) => (
                    <TableRow key={resource.id} data-testid={`row-resource-${resource.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedResources.has(resource.id)}
                          onCheckedChange={() => toggleResourceSelection(resource.id)}
                          data-testid={`checkbox-resource-${resource.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <Badge variant="outline" data-testid={`badge-userid-${resource.id}`}>
                            {editingResource === resource.id ? (
                              <Input
                                value={editingFields.userID}
                                onChange={(e) => setEditingFields({ ...editingFields, userID: e.target.value })}
                                className="h-6 w-32"
                                data-testid={`input-edit-userid-${resource.id}`}
                              />
                            ) : (
                              resource.userID
                            )}
                          </Badge>
                          {resource.targetUserID && (
                            <div className="text-xs text-green-600" data-testid={`text-target-userid-${resource.id}`}>
                              → Target: {resource.targetUserID}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingResource === resource.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingFields.firstName}
                              onChange={(e) => setEditingFields({ ...editingFields, firstName: e.target.value })}
                              placeholder="First Name"
                              className="h-8"
                              data-testid={`input-edit-firstname-${resource.id}`}
                            />
                            <Input
                              value={editingFields.lastName}
                              onChange={(e) => setEditingFields({ ...editingFields, lastName: e.target.value })}
                              placeholder="Last Name"
                              className="h-8"
                              data-testid={`input-edit-lastname-${resource.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => saveResource(resource.id)}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-${resource.id}`}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                              data-testid={`button-cancel-edit-${resource.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span data-testid={`text-name-${resource.id}`}>
                            {`${resource.firstName || ''} ${resource.lastName || ''}`.trim() || '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {resource.sourceConnectionId ? (
                          <Badge variant="outline" data-testid={`badge-source-api-${resource.id}`}>API</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-source-import-${resource.id}`}>Import</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span data-testid={`text-imported-date-${resource.id}`}>
                          {new Date(resource.importedAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedResource(resource)}
                            data-testid={`button-view-${resource.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(resource)}
                            data-testid={`button-edit-${resource.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" data-testid={`button-delete-${resource.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Resource</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the resource "{resource.userID}"?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid={`button-cancel-delete-${resource.id}`}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteResourceMutation.mutate(resource.id)}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                  data-testid={`button-confirm-delete-${resource.id}`}
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
        
        <Dialog open={!!selectedResource} onOpenChange={() => setSelectedResource(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Resource Details — {selectedResource ? `${selectedResource.firstName || ''} ${selectedResource.lastName || ''}`.trim() || selectedResource.userID : ''}</DialogTitle>
              <DialogDescription>View detailed information and raw XML for this resource</DialogDescription>
            </DialogHeader>
            {selectedResource && (
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="xml">Raw XML</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">User ID</Label>
                      <p className="text-sm text-muted-foreground">{selectedResource.userID}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Name</Label>
                      <p className="text-sm text-muted-foreground">
                        {`${selectedResource.firstName || ''} ${selectedResource.lastName || ''}`.trim() || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Source</Label>
                      <Badge variant={selectedResource.sourceConnectionId ? "outline" : "secondary"}>
                        {selectedResource.sourceConnectionId ? "API" : "XML Import"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge variant={selectedResource.isActive ? "default" : "secondary"}>
                        {selectedResource.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {selectedResource.targetUserID && (
                      <div>
                        <Label className="text-sm font-medium">Target User ID</Label>
                        <p className="text-sm text-green-600">{selectedResource.targetUserID}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium">Imported At</Label>
                      <p className="text-sm text-muted-foreground">{new Date(selectedResource.importedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="xml">
                  <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                    <XmlDisplay id={selectedResource.id} type="resources" projectId={currentProjectId} />
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
                          {migration.settings?.type === 'resources' ? 'Resources Migration' : 'Migration'}
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
              <DialogTitle>Provision Resources to Target System</DialogTitle>
              <DialogDescription>
                Configure the target system for {selectedResources.size} selected resources.
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
