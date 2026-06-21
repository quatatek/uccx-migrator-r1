import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth-token";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useProjectApi } from "@/hooks/use-project-api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertResourceGroupSchema, type ResourceGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Search, Users, Settings, Trash2, CheckCircle, XCircle, ArrowLeft, Eye, Edit, Save, X, Play, FolderOpen } from "lucide-react";
import { Link } from "wouter";



function XmlDisplay({ id, type, projectId }: { id: string; type: string; projectId: string | null }) {
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

export default function ResourceGroupsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResourceGroup, setEditingResourceGroup] = useState<ResourceGroup | null>(null);
  const [editingResourceGroupId, setEditingResourceGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [selectedResourceGroup, setSelectedResourceGroup] = useState<ResourceGroup | null>(null);
  
  const [selectedResourceGroups, setSelectedResourceGroups] = useState<Set<string>>(new Set());
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

  const { data: resourceGroups = [], isLoading } = useQuery<ResourceGroup[]>({
    queryKey: ["/api/resource-groups", { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/resource-groups'),
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
          Please select a project from the header menu to view and manage resource groups.
        </p>
      </div>
    );
  }

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof insertResourceGroupSchema>) =>
      apiRequest("/api/resource-groups", "POST", { ...data, projectId: currentProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-groups", { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/configurations/stats", { projectId: currentProjectId }] });
      toast({
        title: "Success",
        description: "Resource group created successfully",
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create resource group",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ resourceGroupId, name }: { resourceGroupId: string; name: string }) => {
      const response = await fetch(`/api/resource-groups/${resourceGroupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name, projectId: currentProjectId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update resource group');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-groups", { projectId: currentProjectId }] });
      toast({
        title: "Success",
        description: "Resource group updated successfully",
      });
      setEditingResourceGroupId(null);
      setEditingName("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update resource group",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/resource-groups/${id}?projectId=${currentProjectId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-groups", { projectId: currentProjectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/configurations/stats", { projectId: currentProjectId }] });
      toast({
        title: "Success",
        description: "Resource group deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete resource group",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof insertResourceGroupSchema>>({
    resolver: zodResolver(insertResourceGroupSchema),
    defaultValues: {
      resourceGroupId: 0,
      name: "",
      self: null,
      sourceConnectionId: null,
      isActive: true,
      metadata: null,
    },
  });

  const toggleResourceGroupSelection = (resourceGroupId: string) => {
    const newSelection = new Set(selectedResourceGroups);
    if (newSelection.has(resourceGroupId)) {
      newSelection.delete(resourceGroupId);
    } else {
      newSelection.add(resourceGroupId);
    }
    setSelectedResourceGroups(newSelection);
  };

  const selectAllResourceGroups = () => {
    setSelectedResourceGroups(new Set(filteredResourceGroups.map((rg: ResourceGroup) => rg.id)));
  };

  const clearSelection = () => {
    setSelectedResourceGroups(new Set());
  };

  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!targetConnectionId) {
        throw new Error('Target system is required');
      }

      const selectedResourceGroupData = (resourceGroups as ResourceGroup[]).filter(rg => selectedResourceGroups.has(rg.id));
      
      const migrationJob = {
        configurationId: null,
        targetConnectionId,
        status: 'pending' as const,
        progress: 0,
        projectId: currentProjectId,
        settings: {
          type: 'resource-groups',
          resourceGroups: selectedResourceGroupData,
          options: migrationOptions,
        },
      };

      const response = await apiRequest('POST', '/api/migrations', migrationJob);
      return response.json();
    },
    onSuccess: () => {
      setShowProvisionDialog(false);
      setSelectedResourceGroups(new Set());
      setTargetConnectionId("");
      queryClient.invalidateQueries({ queryKey: ['/api/migrations/active', { projectId: currentProjectId }] });
      toast({
        title: "Migration Started",
        description: `Started provisioning ${selectedResourceGroups.size} resource groups to target system.`,
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

  const onSubmit = (data: z.infer<typeof insertResourceGroupSchema>) => {
    createMutation.mutate(data);
  };

  const handleEdit = (resourceGroup: ResourceGroup) => {
    setEditingResourceGroupId(resourceGroup.id);
    setEditingName(resourceGroup.name);
  };

  const handleSave = (resourceGroupId: string) => {
    updateMutation.mutate({ resourceGroupId, name: editingName });
  };

  const handleCancel = () => {
    setEditingResourceGroupId(null);
    setEditingName("");
  };

  const handleView = (resourceGroup: ResourceGroup) => {
    setSelectedResourceGroup(resourceGroup);
  };

  const filteredResourceGroups = (resourceGroups as ResourceGroup[]).filter((rg: ResourceGroup) =>
    rg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rg.resourceGroupId.toString().includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/configurations">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Configurations
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Resource Groups</h1>
            <p className="text-muted-foreground">
              Manage UCCX resource groups and their configurations
            </p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Users className="mr-2 h-4 w-4" />
              Add Resource Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Resource Group</DialogTitle>
              <DialogDescription>
                Add a new resource group to the system
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="resourceGroupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resource Group ID</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter resource group ID"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter resource group name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="self"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Self URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter self URL" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Enable this resource group
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredResourceGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Play className="h-5 w-5" />
              <span>Bulk Provision</span>
            </CardTitle>
            <CardDescription>
              Select resource groups to provision to target UCCX systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllResourceGroups}
                  disabled={selectedResourceGroups.size === filteredResourceGroups.length}
                >
                  Select All ({filteredResourceGroups.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedResourceGroups.size === 0}
                >
                  Clear Selection
                </Button>
                {selectedResourceGroups.size > 0 && (
                  <Badge variant="secondary" className="px-3 py-1">
                    {selectedResourceGroups.size} selected
                  </Badge>
                )}
              </div>
              <Button
                onClick={() => setShowProvisionDialog(true)}
                disabled={selectedResourceGroups.size === 0 || targetSystems.length === 0}
                className="flex items-center space-x-2"
                data-testid="button-provision-resource-groups"
              >
                <Play className="h-4 w-4" />
                <span>Provision Selected</span>
              </Button>
            </div>
            {targetSystems.length === 0 && (
              <p className="text-sm text-amber-600 mt-2">
                No target systems configured. Configure target systems first to enable provisioning.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resource Groups Overview</CardTitle>
          <CardDescription>
            View and manage all resource groups in the system
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resource groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading resource groups...</div>
            </div>
          ) : filteredResourceGroups.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">
                {searchQuery ? "No resource groups found matching your search." : "No resource groups found."}
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
                {filteredResourceGroups.map((resourceGroup: ResourceGroup) => (
                  <TableRow key={resourceGroup.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedResourceGroups.has(resourceGroup.id)}
                        onCheckedChange={() => toggleResourceGroupSelection(resourceGroup.id)}
                        data-testid={`checkbox-resource-group-${resourceGroup.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        {resourceGroup.resourceGroupId}
                        {(resourceGroup as any).targetResourceGroupId && (
                          <div className="text-xs text-green-600">
                            → Target: {(resourceGroup as any).targetResourceGroupId}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingResourceGroupId === resourceGroup.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSave(resourceGroup.id)}
                            disabled={updateMutation.isPending}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        resourceGroup.name
                      )}
                    </TableCell>
                    <TableCell>
                      {resourceGroup.sourceConnectionId ? (
                        <Badge variant="outline">API</Badge>
                      ) : (
                        <Badge variant="secondary">Import</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(resourceGroup.importedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(resourceGroup)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(resourceGroup)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Resource Group</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the resource group "{resourceGroup.name}"?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(resourceGroup.id)}
                                className="bg-red-600 text-white hover:bg-red-700"
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
                        {migration.settings?.type === 'resource-groups' ? 'Resource Groups Migration' : 'Migration'}
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

      <Dialog open={!!selectedResourceGroup} onOpenChange={() => setSelectedResourceGroup(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resource Group Details — {selectedResourceGroup?.name}</DialogTitle>
            <DialogDescription>View detailed information and raw XML for this resource group</DialogDescription>
          </DialogHeader>
          {selectedResourceGroup && (
            <Tabs defaultValue="details">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="xml">Raw XML</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Resource Group ID</Label>
                    <p className="text-sm text-muted-foreground">{selectedResourceGroup.resourceGroupId}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Name</Label>
                    <p className="text-sm text-muted-foreground">{selectedResourceGroup.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Source</Label>
                    <Badge variant={selectedResourceGroup.sourceConnectionId ? "outline" : "secondary"}>
                      {selectedResourceGroup.sourceConnectionId ? "API" : "XML Import"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={selectedResourceGroup.isActive ? "default" : "secondary"}>
                      {selectedResourceGroup.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Imported At</Label>
                    <p className="text-sm text-muted-foreground">{new Date(selectedResourceGroup.importedAt).toLocaleString()}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="xml">
                <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                  <XmlDisplay id={selectedResourceGroup.id} type="resource-groups" projectId={currentProjectId} />
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Provision Resource Groups to Target System</DialogTitle>
            <DialogDescription>
              Configure the target system for {selectedResourceGroups.size} selected resource groups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="target-system">Target UCCX System</Label>
              <Select value={targetConnectionId} onValueChange={setTargetConnectionId}>
                <SelectTrigger id="target-system">
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
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="create-backup" className="text-sm font-normal">Create Backup</Label>
                <Switch
                  id="create-backup"
                  checked={migrationOptions.createBackup}
                  onCheckedChange={(checked) => setMigrationOptions({ ...migrationOptions, createBackup: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="override-existing" className="text-sm font-normal">Override Existing</Label>
                <Switch
                  id="override-existing"
                  checked={migrationOptions.overrideExisting}
                  onCheckedChange={(checked) => setMigrationOptions({ ...migrationOptions, overrideExisting: checked })}
                />
              </div>
            </div>
            <Button
              onClick={() => provisionMutation.mutate()}
              disabled={!targetConnectionId || provisionMutation.isPending}
              className="w-full"
            >
              {provisionMutation.isPending ? "Starting..." : "Start Migration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
