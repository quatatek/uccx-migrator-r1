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
  Wrench,
  Upload,
  CheckCircle,
  AlertCircle,
  Settings,
  Play,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useProjectApi } from "@/hooks/use-project-api";
import { Link } from "wouter";
import type { Skill } from "@shared/schema";

export default function SkillsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [skillXml, setSkillXml] = useState<string>("");
  const [loadingXml, setLoadingXml] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  
  // Provisioning state
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    if (selectedSkill) {
      setSkillXml("");
      setLoadingXml(true);
      fetch(`/api/skills/${selectedSkill.id}/xml?projectId=${currentProjectId}`, {
        headers: { ...getAuthHeaders() }
      })
        .then(r => r.text())
        .then(xml => setSkillXml(xml))
        .catch(() => setSkillXml("No XML data available"))
        .finally(() => setLoadingXml(false));
    }
  }, [selectedSkill?.id]);

  // Fetch skills
  const { data: skills = [], isLoading } = useQuery<Skill[]>({
    queryKey: ['/api/skills', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/skills'),
    enabled: hasProject,
  });

  // Fetch target systems for provisioning
  const { data: targetSystems = [] } = useQuery({
    queryKey: ['/api/uccx-connections/target', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/uccx-connections/target'),
    enabled: hasProject,
  });

  // Fetch active migrations for real-time updates
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
          Please select a project from the header menu to view and manage skills.
        </p>
      </div>
    );
  }

  // Update skill mutation
  const updateMutation = useMutation({
    mutationFn: async ({ skillId, skillName }: { skillId: string; skillName: string }) => {
      const response = await fetch(`/api/skills/${skillId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ skillName, projectId: currentProjectId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setEditingSkill(null);
      setEditingName("");
      queryClient.invalidateQueries({ queryKey: ['/api/skills', { projectId: currentProjectId }] });
      toast({
        title: "Skill Updated",
        description: "Skill name has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update skill",
        variant: "destructive",
      });
    },
  });

  // Delete skill mutation
  const deleteSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      const response = await fetch(`/api/skills/${skillId}?projectId=${currentProjectId}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/skills', { projectId: currentProjectId }] });
      toast({
        title: "Skill Deleted",
        description: "Skill has been removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete skill",
        variant: "destructive",
      });
    },
  });

  const startEditing = (skill: Skill) => {
    setEditingSkill(skill.id);
    setEditingName(skill.skillName);
  };

  const cancelEditing = () => {
    setEditingSkill(null);
    setEditingName("");
  };

  const saveSkillName = (skillId: string) => {
    if (!editingName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Skill name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ skillId, skillName: editingName.trim() });
  };

  // Provisioning functions
  const toggleSkillSelection = (skillId: string) => {
    const newSelection = new Set(selectedSkills);
    if (newSelection.has(skillId)) {
      newSelection.delete(skillId);
    } else {
      newSelection.add(skillId);
    }
    setSelectedSkills(newSelection);
  };

  const selectAllSkills = () => {
    setSelectedSkills(new Set(filteredSkills.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSkills(new Set());
  };

  // Create migration job mutation
  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!targetConnectionId) {
        throw new Error('Target system is required');
      }

      const selectedSkillData = skills.filter(s => selectedSkills.has(s.id));
      
      const migrationJob = {
        configurationId: null,
        targetConnectionId,
        status: 'pending' as const,
        progress: 0,
        settings: {
          type: 'skills',
          skills: selectedSkillData,
          options: migrationOptions,
        },
      };

      const response = await apiRequest('POST', '/api/migrations', migrationJob);
      return response.json();
    },
    onSuccess: () => {
      setShowProvisionDialog(false);
      setSelectedSkills(new Set());
      setTargetConnectionId("");
      queryClient.invalidateQueries({ queryKey: ['/api/migrations/active'] });
      toast({
        title: "Migration Started",
        description: `Started provisioning ${selectedSkills.size} skills to target system.`,
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

  const filteredSkills = skills.filter(skill => 
    skill.skillName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/configurations">
              <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Configurations</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wrench className="h-6 w-6 text-blue-800" />
                </div>
                <span>Skills Management</span>
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage imported UCCX skills. To import new skills, use the main Import tab.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <Wrench className="h-6 w-6 text-blue-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Skills</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : skills.length}
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
                  <p className="text-sm font-medium text-gray-600">Filtered Results</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : filteredSkills.length}
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
                  <p className="text-sm font-medium text-gray-600">Editable</p>
                  <p className="text-2xl font-bold text-gray-900">Yes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Provision */}
        {filteredSkills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Bulk Provision</span>
              </CardTitle>
              <CardDescription>
                Select skills to provision to target UCCX systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllSkills}
                    disabled={selectedSkills.size === filteredSkills.length}
                  >
                    Select All ({filteredSkills.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedSkills.size === 0}
                  >
                    Clear Selection
                  </Button>
                  {selectedSkills.size > 0 && (
                    <Badge variant="secondary" className="px-3 py-1">
                      {selectedSkills.size} selected
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => setShowProvisionDialog(true)}
                  disabled={selectedSkills.size === 0 || targetSystems.length === 0}
                  className="flex items-center space-x-2"
                  data-testid="button-provision-skills"
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

        {/* Skills List */}
        <Card>
          <CardHeader>
            <CardTitle>Skills Overview</CardTitle>
            <CardDescription>
              View and manage all skills in the system
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading skills...</div>
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">
                  {searchTerm ? "No skills found matching your search." : "No skills found."}
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
                  {filteredSkills.map((skill) => (
                    <TableRow key={skill.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSkills.has(skill.id)}
                          onCheckedChange={() => toggleSkillSelection(skill.id)}
                          data-testid={`checkbox-skill-${skill.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          {skill.skillId}
                          {(skill as any).targetSkillId && (
                            <div className="text-xs text-green-600">
                              → Target: {(skill as any).targetSkillId}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingSkill === skill.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8"
                            />
                            <Button
                              size="sm"
                              onClick={() => saveSkillName(skill.id)}
                              disabled={updateMutation.isPending}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          skill.skillName
                        )}
                      </TableCell>
                      <TableCell>
                        {skill.sourceConnectionId ? (
                          <Badge variant="outline">API</Badge>
                        ) : (
                          <Badge variant="secondary">Import</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(skill.importedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSkill(skill)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(skill)}
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
                                <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the skill "{skill.skillName}"?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSkillMutation.mutate(skill.id)}
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
        
        {/* View Dialog */}
        <Dialog open={!!selectedSkill} onOpenChange={() => { setSelectedSkill(null); setSkillXml(""); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Skill Details — {selectedSkill?.skillName}</DialogTitle>
              <DialogDescription>
                View detailed information and raw XML for this skill
              </DialogDescription>
            </DialogHeader>
            {selectedSkill && (
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="xml">Raw XML</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Skill ID</Label>
                      <p className="text-sm text-muted-foreground">{selectedSkill.skillId}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Name</Label>
                      <p className="text-sm text-muted-foreground">{selectedSkill.skillName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Source</Label>
                      <Badge variant={selectedSkill.sourceConnectionId ? "outline" : "secondary"}>
                        {selectedSkill.sourceConnectionId ? "API" : "XML Import"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge variant={selectedSkill.isActive ? "default" : "secondary"}>
                        {selectedSkill.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {(selectedSkill.metadata as any)?.apiUrl && (
                      <div className="col-span-2">
                        <Label className="text-sm font-medium">API URL</Label>
                        <p className="text-sm text-muted-foreground break-all">{(selectedSkill.metadata as any)?.apiUrl}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium">Imported At</Label>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedSkill.importedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="xml">
                  {loadingXml ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">Loading XML...</div>
                  ) : (
                    <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                      {skillXml || "No XML data available for this skill."}
                    </pre>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Active Migrations */}
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
                          {migration.settings?.type === 'skills' ? 'Skills Migration' : 'Migration'}
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

        {/* Provisioning Dialog */}
        <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Provision Skills to Target System</DialogTitle>
              <DialogDescription>
                Configure the target system and migration options for {selectedSkills.size} selected skills.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="target-system">Target System</Label>
                <Select value={targetConnectionId} onValueChange={setTargetConnectionId}>
                  <SelectTrigger data-testid="select-target-system">
                    <SelectValue placeholder="Select target UCCX system" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetSystems.map((system: any) => (
                      <SelectItem key={system.id} value={system.id}>
                        {system.name} ({system.host}:{system.port})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Migration Options</Label>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dry-run" className="text-sm font-normal">
                      Dry Run
                    </Label>
                    <p className="text-xs text-gray-500">
                      Test migration without making changes
                    </p>
                  </div>
                  <Switch
                    id="dry-run"
                    checked={migrationOptions.dryRun}
                    onCheckedChange={(checked) => 
                      setMigrationOptions(prev => ({ ...prev, dryRun: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="create-backup" className="text-sm font-normal">
                      Create Backup
                    </Label>
                    <p className="text-xs text-gray-500">
                      Backup target system before migration
                    </p>
                  </div>
                  <Switch
                    id="create-backup"
                    checked={migrationOptions.createBackup}
                    onCheckedChange={(checked) => 
                      setMigrationOptions(prev => ({ ...prev, createBackup: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="override-existing" className="text-sm font-normal">
                      Override Existing
                    </Label>
                    <p className="text-xs text-gray-500">
                      Replace existing skills with same ID
                    </p>
                  </div>
                  <Switch
                    id="override-existing"
                    checked={migrationOptions.overrideExisting}
                    onCheckedChange={(checked) => 
                      setMigrationOptions(prev => ({ ...prev, overrideExisting: checked }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowProvisionDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => provisionMutation.mutate()}
                  disabled={!targetConnectionId || provisionMutation.isPending}
                  data-testid="button-start-migration"
                >
                  {provisionMutation.isPending ? (
                    <>
                      <Settings className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Migration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}