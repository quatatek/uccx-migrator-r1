import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/ui/file-upload";
import { Server, Upload, FolderOpen, AlertCircle, Trash2, Database, RotateCcw, Plus } from "lucide-react";
import { useProject } from "@/contexts/project-context";
import { useProjectApi } from "@/hooks/use-project-api";
import { apiRequest } from "@/lib/queryClient";

interface ImportFormData {
  name: string;
  description: string;
  autoProcess: boolean;
  createBackup: boolean;
}

interface ApiImportFormData {
  sourceConnectionId: string;
  configTypes: string[];
  createBackup: boolean;
}

export default function Import() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState<ImportFormData>({
    name: "",
    description: "",
    autoProcess: true,
    createBackup: false,
  });
  const [apiImportData, setApiImportData] = useState<ApiImportFormData>({
    sourceConnectionId: "",
    configTypes: [],
    createBackup: false,
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentProject } = useProject();
  const { currentProjectId, hasProject, projectFetch, projectRequest } = useProjectApi();

  // Fetch source systems
  const { data: sourceSystems = [] } = useQuery<any[]>({
    queryKey: ['/api/uccx-connections/source', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/uccx-connections/source'),
    enabled: hasProject,
  });

  // Fetch snapshots
  const { data: snapshots = [] } = useQuery<any[]>({
    queryKey: ['/api/snapshots', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/snapshots'),
    enabled: hasProject,
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async (name?: string) => {
      return await projectRequest('POST', '/api/snapshots', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      toast({ title: "Snapshot Created", description: "Project data has been saved as a snapshot." });
    },
    onError: (error: any) => {
      toast({ title: "Snapshot Failed", description: error.message || "Failed to create snapshot", variant: "destructive" });
    },
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (id: string) => {
      return await projectRequest('DELETE', `/api/snapshots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      toast({ title: "Snapshot Deleted" });
    },
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: async (id: string) => {
      return await projectRequest('POST', `/api/snapshots/${id}/restore`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/skills'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resource-groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/csqs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/triggers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/configurations/stats'] });
      setConfirmRestoreId(null);
      toast({ title: "Project Restored", description: data?.message || "Project data has been restored from snapshot." });
    },
    onError: (error: any) => {
      setConfirmRestoreId(null);
      toast({ title: "Restore Failed", description: error.message || "Failed to restore snapshot", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!currentProjectId) {
        throw new Error('No project selected');
      }
      const response = await projectRequest('POST', '/api/configurations/import-multiple', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.failed > 0) {
        toast({
          title: "Import Completed with Errors",
          description: `${data.successful} file(s) imported successfully, ${data.failed} failed. ${data.errors?.[0] || ''}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Import Successful",
          description: data.message || "All configurations have been imported and processed successfully.",
        });
      }
      
      // Reset form
      setSelectedFiles([]);
      setFormData({
        name: "",
        description: "",
        autoProcess: true,
        createBackup: false,
      });
      setUploadProgress(0);
      
      // Invalidate all configuration queries including stats
      queryClient.invalidateQueries({ queryKey: ['/api/configurations/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/configurations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/skills'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resource-groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/csqs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/triggers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import configurations",
        variant: "destructive",
      });
    },
  });

  const apiImportMutation = useMutation({
    mutationFn: async (data: ApiImportFormData) => {
      if (!currentProjectId) {
        throw new Error('No project selected');
      }
      return await projectRequest('POST', '/api/configurations/import-from-api', {
        sourceConnectionId: data.sourceConnectionId,
        configTypes: data.configTypes.length > 0 ? data.configTypes : undefined,
        createBackup: data.createBackup,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "API Import Successful",
        description: `Successfully imported configurations from ${data.sourceConnection || 'source system'}`,
      });
      
      // Reset form
      setApiImportData({ sourceConnectionId: "", configTypes: [], createBackup: false });
      
      // Invalidate all configuration queries including stats
      queryClient.invalidateQueries({ queryKey: ['/api/configurations/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/configurations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/skills'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resource-groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/csqs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/triggers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
    },
    onError: (error: any) => {
      toast({
        title: "API Import Failed",
        description: error.message || "Failed to import from API",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one XML file to import.",
        variant: "destructive",
      });
      return;
    }

    const formDataToSend = new FormData();
    
    // Append each file
    selectedFiles.forEach((file, index) => {
      formDataToSend.append('xmlFiles', file);
    });
    
    // Append form data
    formDataToSend.append('name', formData.name || `Batch Import - ${new Date().toISOString().split('T')[0]}`);
    formDataToSend.append('description', formData.description);
    formDataToSend.append('autoProcess', formData.autoProcess.toString());
    formDataToSend.append('createBackup', formData.createBackup.toString());

    importMutation.mutate(formDataToSend);
  };

  const handleInputChange = (field: keyof ImportFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApiImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiImportData.sourceConnectionId) {
      toast({
        title: "No Source System Selected",
        description: "Please select a source UCCX system to import from.",
        variant: "destructive",
      });
      return;
    }

    apiImportMutation.mutate(apiImportData);
  };

  const toggleConfigType = (type: string) => {
    setApiImportData(prev => ({
      ...prev,
      configTypes: prev.configTypes.includes(type)
        ? prev.configTypes.filter(t => t !== type)
        : [...prev.configTypes, type]
    }));
  };

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Import Configuration</h1>
          <p className="text-gray-600 mt-2">
            Import UCCX configurations from XML files or directly from a source system via API
          </p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Selected</h3>
            <p className="text-gray-600">
              Please select a project from the header to import configurations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl space-y-6">
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" data-testid="tab-file-upload">
              <Upload className="h-4 w-4 mr-2" />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="api" data-testid="tab-api-import">
              <Server className="h-4 w-4 mr-2" />
              API Import
            </TabsTrigger>
          </TabsList>

          {/* File Upload Tab */}
          <TabsContent value="file" className="space-y-6">
            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Upload XML Files</CardTitle>
                <p className="text-sm text-gray-600">Upload XML configuration files from your source UCCX system. Supports Skills, Resource Groups, CSQs, Resources, Teams, Applications, and Triggers.</p>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileSelect={setSelectedFiles}
                  onUploadProgress={setUploadProgress}
                  maxFiles={20}
                />
              </CardContent>
            </Card>

            {/* Import Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Import Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Configuration Name</Label>
                    <Input
                      id="name"
                      data-testid="input-config-name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder={selectedFiles.length > 0 ? `Batch import (${selectedFiles.length} files)` : "Enter configuration name"}
                    />
                    <p className="text-sm text-gray-500">The system will automatically detect the configuration type from your uploaded files</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      data-testid="input-description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Enter a description for this configuration..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="autoProcess"
                        data-testid="checkbox-auto-process"
                        checked={formData.autoProcess}
                        onCheckedChange={(checked) => handleInputChange('autoProcess', checked)}
                      />
                      <Label htmlFor="autoProcess" className="text-sm">
                        Automatically parse and populate database
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="createBackup"
                        data-testid="checkbox-create-backup"
                        checked={formData.createBackup}
                        onCheckedChange={(checked) => handleInputChange('createBackup', checked)}
                      />
                      <div>
                        <Label htmlFor="createBackup" className="text-sm">Snapshot project data before import</Label>
                        <p className="text-xs text-muted-foreground">Saves current configuration state so you can revert if the import causes issues</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-cancel-file"
                      onClick={() => {
                        setSelectedFiles([]);
                        setFormData({
                          name: "",
                          description: "",
                          autoProcess: true,
                          createBackup: false,
                        });
                      }}
                      disabled={importMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      data-testid="button-start-import"
                      className="bg-cisco-blue hover:bg-cisco-dark"
                      disabled={selectedFiles.length === 0 || importMutation.isPending}
                    >
                      {importMutation.isPending ? "Processing..." : "Start Import"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Import Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import from Source UCCX System</CardTitle>
                <p className="text-sm text-gray-600">Connect to a source UCCX system and import configurations directly via API.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleApiImportSubmit} className="space-y-6">
                  {/* Source System Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="sourceSystem">Source UCCX System</Label>
                    {sourceSystems && sourceSystems.length > 0 ? (
                      <Select
                        value={apiImportData.sourceConnectionId}
                        onValueChange={(value) => setApiImportData(prev => ({ ...prev, sourceConnectionId: value }))}
                      >
                        <SelectTrigger data-testid="select-source-system">
                          <SelectValue placeholder="Select a source system" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceSystems.map((system: any) => (
                            <SelectItem key={system.id} value={system.id}>
                              {system.name} ({system.host})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-4 border border-dashed border-gray-300 rounded-md text-center text-sm text-gray-500">
                        No source systems configured. Please add a source UCCX connection in the Servers tab.
                      </div>
                    )}
                  </div>

                  {/* Configuration Types Selection */}
                  <div className="space-y-2">
                    <Label>Configuration Types to Import</Label>
                    <p className="text-sm text-gray-500 mb-3">Select specific types or leave empty to import all</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'skills', label: 'Skills' },
                        { id: 'resourceGroups', label: 'Resource Groups' },
                        { id: 'csqs', label: 'CSQs' },
                        { id: 'resources', label: 'Resources' },
                        { id: 'teams', label: 'Teams' },
                        { id: 'applications', label: 'Applications' },
                        { id: 'triggers', label: 'Triggers' },
                      ].map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type.id}`}
                            data-testid={`checkbox-${type.id}`}
                            checked={apiImportData.configTypes.includes(type.id)}
                            onCheckedChange={() => toggleConfigType(type.id)}
                          />
                          <Label htmlFor={`type-${type.id}`} className="text-sm font-normal">
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {apiImportData.configTypes.length === 0 
                        ? "All configuration types will be imported" 
                        : `${apiImportData.configTypes.length} type(s) selected`}
                    </p>
                  </div>

                  {/* Snapshot option */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="apiCreateBackup"
                      data-testid="checkbox-api-create-backup"
                      checked={apiImportData.createBackup}
                      onCheckedChange={(checked) => setApiImportData(prev => ({ ...prev, createBackup: !!checked }))}
                    />
                    <div>
                      <Label htmlFor="apiCreateBackup" className="text-sm">Snapshot project data before import</Label>
                      <p className="text-xs text-muted-foreground">Saves current configuration state so you can revert if needed</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-cancel-api"
                      onClick={() => setApiImportData({ sourceConnectionId: "", configTypes: [], createBackup: false })}
                      disabled={apiImportMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      data-testid="button-start-api-import"
                      className="bg-cisco-blue hover:bg-cisco-dark"
                      disabled={!apiImportData.sourceConnectionId || apiImportMutation.isPending}
                    >
                      {apiImportMutation.isPending ? "Importing..." : "Start API Import"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Project Snapshots Section */}
        {hasProject && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Project Snapshots</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => createSnapshotMutation.mutate(undefined)}
                  disabled={createSnapshotMutation.isPending}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {createSnapshotMutation.isPending ? "Saving..." : "Create Snapshot Now"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Snapshots capture the complete project configuration state. Restore any snapshot to roll back all configuration data.
              </p>
            </CardHeader>
            <CardContent>
              {snapshots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No snapshots yet. Snapshots are created automatically when you import with the snapshot option enabled, or you can create one manually.
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map((snapshot: any) => {
                    const counts = snapshot.counts as Record<string, number> | null;
                    const totalRecords = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
                    return (
                      <div key={snapshot.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{snapshot.name}</p>
                            {snapshot.snapshotType === 'pre-import' && (
                              <Badge variant="outline" className="text-xs shrink-0">Pre-import</Badge>
                            )}
                            {snapshot.snapshotType === 'manual' && (
                              <Badge variant="outline" className="text-xs shrink-0">Manual</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(snapshot.createdAt).toLocaleString()}
                            {totalRecords > 0 && ` · ${totalRecords} records`}
                            {counts && (
                              <span className="ml-1">
                                ({Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ')})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmRestoreId(snapshot.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteSnapshotMutation.mutate(snapshot.id)}
                            disabled={deleteSnapshotMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Restore Confirmation Dialog */}
        <Dialog open={!!confirmRestoreId} onOpenChange={(open) => { if (!open) setConfirmRestoreId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Snapshot</DialogTitle>
              <DialogDescription>
                This will replace all current project configuration data (skills, resource groups, CSQs, resources, teams, applications, and triggers) with the data from this snapshot. This action cannot be undone unless you have another snapshot.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmRestoreId(null)} disabled={restoreSnapshotMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => confirmRestoreId && restoreSnapshotMutation.mutate(confirmRestoreId)}
                disabled={restoreSnapshotMutation.isPending}
              >
                {restoreSnapshotMutation.isPending ? "Restoring..." : "Yes, Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
