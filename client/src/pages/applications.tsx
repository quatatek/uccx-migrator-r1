import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth-token";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload, Code, Trash2, Edit2, Eye, Play, Settings, FileText, FolderOpen } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useProjectApi } from "@/hooks/use-project-api";
import { apiRequest } from "@/lib/queryClient";

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

export default function ApplicationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentProjectId, hasProject, projectFetch, getProjectUrl } = useProjectApi();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set());
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingApplication, setViewingApplication] = useState<any>(null);
  const [editingApplication, setEditingApplication] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<any>({});
  const [targetConnectionId, setTargetConnectionId] = useState("");
  const [migrationOptions, setMigrationOptions] = useState({
    dryRun: false,
    createBackup: true,
    overrideExisting: false,
  });

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["/api/applications", { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/applications'),
    enabled: hasProject,
  });

  const { data: targetSystems = [] } = useQuery({
    queryKey: ["/api/uccx-connections/target", { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/uccx-connections/target'),
    enabled: hasProject,
  });

  const { data: activeMigrations = [] } = useQuery({
    queryKey: ["/api/migrations/active", { projectId: currentProjectId }],
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
          Please select a project from the header menu to view and manage applications.
        </p>
      </div>
    );
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/applications/${id}?projectId=${currentProjectId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", { projectId: currentProjectId }] });
      toast({ title: "Success", description: "Application deleted successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/applications/${id}`, "PUT", { ...data, projectId: currentProjectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", { projectId: currentProjectId }] });
      toast({ title: "Success", description: "Application updated successfully" });
      setEditingApplication(null);
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/migrations", "POST", { ...data, projectId: currentProjectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/migrations/active", { projectId: currentProjectId }] });
      toast({ title: "Success", description: "Migration started successfully" });
      setShowProvisionDialog(false);
      setSelectedApplications(new Set());
    },
  });

  const filteredApplications = applications.filter((app: any) =>
    app.applicationName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProvision = () => {
    if (!targetConnectionId) {
      toast({ title: "Error", description: "Please select a target system", variant: "destructive" });
      return;
    }

    const selectedApps = applications.filter((app: any) => selectedApplications.has(app.id));
    provisionMutation.mutate({
      targetConnectionId,
      status: "pending",
      progress: 0,
      settings: {
        type: "applications",
        applications: selectedApps.map((app: any) => ({ ...app, targetConnectionId })),
        options: migrationOptions,
      },
    });
  };

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
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Code className="h-6 w-6 text-purple-800" />
                </div>
                <span>Applications Management</span>
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage imported UCCX applications.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                  <Code className="h-6 w-6 text-purple-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Applications</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : applications.length}
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
                  <p className="text-sm font-medium text-gray-600">Imported</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : applications.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <Settings className="h-6 w-6 text-blue-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Provisioned</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : applications.filter((a: any) => a.targetApplicationName).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedApplications.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Bulk Provision</span>
              </CardTitle>
              <CardDescription>
                Select applications to provision to target UCCX systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm" onClick={() => setSelectedApplications(new Set(filteredApplications.map((a: any) => a.id)))} data-testid="button-select-all">
                    Select All ({filteredApplications.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedApplications(new Set())} data-testid="button-clear-selection">
                    Clear Selection
                  </Button>
                  <Badge variant="secondary" className="px-3 py-1">{selectedApplications.size} selected</Badge>
                </div>
                <Button onClick={() => setShowProvisionDialog(true)} disabled={selectedApplications.size === 0} data-testid="button-provision-applications">
                  <Play className="h-4 w-4 mr-2" />
                  Provision Selected
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Applications Overview</CardTitle>
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="input-search"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading applications...</div>
            ) : filteredApplications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No applications found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>Application Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Max Sessions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app: any) => (
                    <TableRow key={app.id} data-testid={`row-application-${app.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedApplications.has(app.id)}
                          onCheckedChange={() => {
                            const newSelected = new Set(selectedApplications);
                            if (newSelected.has(app.id)) newSelected.delete(app.id);
                            else newSelected.add(app.id);
                            setSelectedApplications(newSelected);
                          }}
                          data-testid={`checkbox-application-${app.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {editingApplication === app.id ? (
                          <Input
                            value={editingFields.applicationName}
                            onChange={(e) => setEditingFields({ ...editingFields, applicationName: e.target.value })}
                            className="h-8"
                            data-testid={`input-edit-name-${app.id}`}
                          />
                        ) : (
                          <div>
                            <div>{app.applicationName}</div>
                            {app.targetApplicationName && (
                              <div className="text-xs text-green-600">→ Target: {app.targetApplicationName}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{app.type || "Unknown"}</Badge></TableCell>
                      <TableCell>{app.maxsession || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={app.enabled ? "default" : "secondary"}>
                          {app.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {editingApplication === app.id ? (
                            <>
                              <Button size="sm" onClick={() => updateMutation.mutate({ id: app.id, data: editingFields })} data-testid={`button-save-${app.id}`}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingApplication(null)} data-testid={`button-cancel-${app.id}`}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => { setViewingApplication(app); setShowViewDialog(true); }} data-testid={`button-view-${app.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingApplication(app.id); setEditingFields(app); }} data-testid={`button-edit-${app.id}`}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(app.id)} data-testid={`button-delete-${app.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
                      <Badge variant={migration.status === "running" ? "default" : "secondary"}>{migration.status}</Badge>
                      <span className="text-sm text-gray-500">{migration.progress}% complete</span>
                    </div>
                    <Progress value={migration.progress} className="mb-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Provision Applications to Target System</DialogTitle>
              <DialogDescription>
                Configure the target system for {selectedApplications.size} selected applications.
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
                  <Switch id="dry-run" checked={migrationOptions.dryRun} onCheckedChange={(checked) => setMigrationOptions({ ...migrationOptions, dryRun: checked })} data-testid="switch-dry-run" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-backup" className="text-sm font-normal">Create Backup</Label>
                  <Switch id="create-backup" checked={migrationOptions.createBackup} onCheckedChange={(checked) => setMigrationOptions({ ...migrationOptions, createBackup: checked })} data-testid="switch-create-backup" />
                </div>
              </div>
              <Button onClick={handleProvision} disabled={!targetConnectionId || provisionMutation.isPending} className="w-full" data-testid="button-start-migration">
                {provisionMutation.isPending ? "Starting..." : "Start Migration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Application Details — {viewingApplication?.applicationName}</DialogTitle>
              <DialogDescription>View detailed information and raw XML for this application</DialogDescription>
            </DialogHeader>
            {viewingApplication && (
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="xml">Raw XML</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Application Name</Label>
                      <p className="text-sm text-muted-foreground">{viewingApplication.applicationName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Type</Label>
                      <p className="text-sm text-muted-foreground">{viewingApplication.type || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-muted-foreground">{viewingApplication.description || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Max Sessions</Label>
                      <p className="text-sm text-muted-foreground">{viewingApplication.maxsession || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Script</Label>
                      <p className="text-sm text-muted-foreground font-mono text-xs">{viewingApplication.script || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge variant={viewingApplication.enabled ? "default" : "secondary"}>
                        {viewingApplication.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Source</Label>
                      <Badge variant={viewingApplication.sourceConnectionId ? "outline" : "secondary"}>
                        {viewingApplication.sourceConnectionId ? "API" : "XML Import"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Imported At</Label>
                      <p className="text-sm text-muted-foreground">{new Date(viewingApplication.importedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="xml">
                  <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                    <XmlDisplay id={viewingApplication.id} type="applications" projectId={currentProjectId} />
                  </pre>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
