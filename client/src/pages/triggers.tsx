import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth-token";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload, Phone, Trash2, Edit2, Eye, Play, Settings, Code, FileText, FolderOpen } from "lucide-react";
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

export default function TriggersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentProjectId, hasProject, projectFetch, getProjectUrl } = useProjectApi();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTriggers, setSelectedTriggers] = useState<Set<string>>(new Set());
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingTrigger, setViewingTrigger] = useState<any>(null);
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<any>({});
  const [targetConnectionId, setTargetConnectionId] = useState("");
  const [migrationOptions, setMigrationOptions] = useState({
    dryRun: false,
    createBackup: true,
    overrideExisting: false,
  });

  const { data: triggers = [], isLoading } = useQuery({
    queryKey: ["/api/triggers", { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/triggers'),
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
          Please select a project from the header menu to view and manage triggers.
        </p>
      </div>
    );
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/triggers/${id}?projectId=${currentProjectId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/triggers", { projectId: currentProjectId }] });
      toast({ title: "Success", description: "Trigger deleted successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/triggers/${id}`, "PUT", { ...data, projectId: currentProjectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/triggers", { projectId: currentProjectId }] });
      toast({ title: "Success", description: "Trigger updated successfully" });
      setEditingTrigger(null);
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
      setSelectedTriggers(new Set());
    },
  });

  const filteredTriggers = triggers.filter((trigger: any) =>
    trigger.directoryNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trigger.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trigger.deviceName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProvision = () => {
    if (!targetConnectionId) {
      toast({ title: "Error", description: "Please select a target system", variant: "destructive" });
      return;
    }

    const selectedTrigs = triggers.filter((trigger: any) => selectedTriggers.has(trigger.id));
    provisionMutation.mutate({
      targetConnectionId,
      status: "pending",
      progress: 0,
      settings: {
        type: "triggers",
        triggers: selectedTrigs.map((trigger: any) => ({ ...trigger, targetConnectionId })),
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
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Phone className="h-6 w-6 text-indigo-800" />
                </div>
                <span>Triggers Management</span>
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage imported UCCX triggers.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                  <Phone className="h-6 w-6 text-indigo-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Triggers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : triggers.length}
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
                    {isLoading ? "..." : triggers.length}
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
                    {isLoading ? "..." : triggers.filter((t: any) => t.targetDirectoryNumber).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedTriggers.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Bulk Provision</span>
              </CardTitle>
              <CardDescription>
                Select triggers to provision to target UCCX systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm" onClick={() => setSelectedTriggers(new Set(filteredTriggers.map((t: any) => t.id)))} data-testid="button-select-all">
                    Select All ({filteredTriggers.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedTriggers(new Set())} data-testid="button-clear-selection">
                    Clear Selection
                  </Button>
                  <Badge variant="secondary" className="px-3 py-1">{selectedTriggers.size} selected</Badge>
                </div>
                <Button onClick={() => setShowProvisionDialog(true)} disabled={selectedTriggers.size === 0} data-testid="button-provision-triggers">
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
              <CardTitle>Triggers Overview</CardTitle>
              <Input
                placeholder="Search triggers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="input-search"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading triggers...</div>
            ) : filteredTriggers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No triggers found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>Directory Number</TableHead>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Call Control Group ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTriggers.map((trigger: any) => (
                    <TableRow key={trigger.id} data-testid={`row-trigger-${trigger.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTriggers.has(trigger.id)}
                          onCheckedChange={() => {
                            const newSelected = new Set(selectedTriggers);
                            if (newSelected.has(trigger.id)) newSelected.delete(trigger.id);
                            else newSelected.add(trigger.id);
                            setSelectedTriggers(newSelected);
                          }}
                          data-testid={`checkbox-trigger-${trigger.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {editingTrigger === trigger.id ? (
                          <Input
                            value={editingFields.directoryNumber}
                            onChange={(e) => setEditingFields({ ...editingFields, directoryNumber: e.target.value })}
                            className="h-8"
                            data-testid={`input-edit-directory-${trigger.id}`}
                          />
                        ) : (
                          <div>
                            <div>{trigger.directoryNumber}</div>
                            {trigger.targetDirectoryNumber && (
                              <div className="text-xs text-green-600">→ Target: {trigger.targetDirectoryNumber}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{trigger.deviceName || "N/A"}</TableCell>
                      <TableCell><Badge variant="outline">{trigger.applicationName || "N/A"}</Badge></TableCell>
                      <TableCell>
                        {editingTrigger === trigger.id ? (
                          <Input
                            value={editingFields.callControlGroupId || ""}
                            onChange={(e) => setEditingFields({ ...editingFields, callControlGroupId: e.target.value })}
                            placeholder="CCG ID"
                            className="h-8 w-24"
                            data-testid={`input-edit-ccg-${trigger.id}`}
                          />
                        ) : (
                          <Badge variant="secondary">{trigger.callControlGroupId || "Not Set"}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={trigger.triggerEnabled ? "default" : "secondary"}>
                          {trigger.triggerEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {editingTrigger === trigger.id ? (
                            <>
                              <Button size="sm" onClick={() => updateMutation.mutate({ id: trigger.id, data: editingFields })} data-testid={`button-save-${trigger.id}`}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingTrigger(null)} data-testid={`button-cancel-${trigger.id}`}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => { setViewingTrigger(trigger); setShowViewDialog(true); }} data-testid={`button-view-${trigger.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingTrigger(trigger.id); setEditingFields(trigger); }} data-testid={`button-edit-${trigger.id}`}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(trigger.id)} data-testid={`button-delete-${trigger.id}`}>
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
              <DialogTitle>Provision Triggers to Target System</DialogTitle>
              <DialogDescription>
                Configure the target system for {selectedTriggers.size} selected triggers.
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
              <DialogTitle>Trigger Details — {viewingTrigger?.directoryNumber}</DialogTitle>
              <DialogDescription>View detailed information and raw XML for this trigger</DialogDescription>
            </DialogHeader>
            {viewingTrigger && (
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="xml">Raw XML</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Directory Number</Label>
                      <p className="text-sm text-muted-foreground">{viewingTrigger.directoryNumber}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Device Name</Label>
                      <p className="text-sm text-muted-foreground">{viewingTrigger.deviceName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Application</Label>
                      <p className="text-sm text-muted-foreground">{viewingTrigger.applicationName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Call Control Group ID</Label>
                      <p className="text-sm text-muted-foreground">{viewingTrigger.callControlGroupId || "Not Set"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-muted-foreground">{viewingTrigger.description || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Max Sessions</Label>
                      <p className="text-sm text-muted-foreground">{viewingTrigger.maxNumOfSessions || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Device Pool</Label>
                      <p className="text-sm text-muted-foreground">{viewingTrigger.devicePool || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge variant={viewingTrigger.triggerEnabled ? "default" : "secondary"}>
                        {viewingTrigger.triggerEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Source</Label>
                      <Badge variant={viewingTrigger.sourceConnectionId ? "outline" : "secondary"}>
                        {viewingTrigger.sourceConnectionId ? "API" : "XML Import"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Imported At</Label>
                      <p className="text-sm text-muted-foreground">{new Date(viewingTrigger.importedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="xml">
                  <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                    <XmlDisplay id={viewingTrigger.id} type="triggers" projectId={currentProjectId} />
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
