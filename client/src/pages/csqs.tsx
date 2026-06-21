import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth-token";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  List, 
  Search, 
  Edit, 
  Eye, 
  Trash2, 
  Save, 
  X,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  Play,
  Settings,
  FolderOpen
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useProjectApi } from "@/hooks/use-project-api";
import { apiRequest } from "@/lib/queryClient";
import type { CSQ, Skill, ResourceGroup } from "@shared/schema";

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

export default function CSQsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCSQ, setEditingCSQ] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedCSQ, setSelectedCSQ] = useState<CSQ | null>(null);
  
  const [selectedCSQs, setSelectedCSQs] = useState<Set<string>>(new Set());
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

  const { data: csqs = [], isLoading, error } = useQuery<CSQ[]>({
    queryKey: ['/api/csqs', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/csqs'),
    enabled: hasProject,
    staleTime: 0,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/csqs', { projectId: currentProjectId }] });
    queryClient.refetchQueries({ queryKey: ['/api/csqs', { projectId: currentProjectId }] });
  };

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['/api/skills', { projectId: currentProjectId }],
    queryFn: async () => projectFetch('/api/skills'),
    enabled: hasProject,
  });

  const { data: resourceGroups = [] } = useQuery<ResourceGroup[]>({
    queryKey: ['/api/resource-groups', { projectId: currentProjectId }],
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

  const { data: csqSkills = [] } = useQuery({
    queryKey: ['/api/csqs', selectedCSQ?.id, 'skills', { projectId: currentProjectId }],
    queryFn: async () => projectFetch(`/api/csqs/${selectedCSQ?.id}/skills`),
    enabled: !!selectedCSQ?.id && hasProject,
  });

  if (!hasProject) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a project from the header menu to view and manage CSQs.
        </p>
      </div>
    );
  }

  const updateMutation = useMutation({
    mutationFn: async ({ csqId, name }: { csqId: string; name: string }) => {
      const response = await fetch(`/api/csqs/${csqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name, projectId: currentProjectId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/csqs', { projectId: currentProjectId }] });
      setEditingCSQ(null);
      setEditingName("");
      toast({
        title: "CSQ Updated",
        description: "CSQ name has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update CSQ",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (csqId: string) => {
      const response = await fetch(`/api/csqs/${csqId}?projectId=${currentProjectId}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/csqs', { projectId: currentProjectId }] });
      toast({
        title: "CSQ Deleted",
        description: "CSQ has been removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete CSQ",
        variant: "destructive",
      });
    },
  });

  const startEditing = (csq: CSQ) => {
    setEditingCSQ(csq.id);
    setEditingName(csq.name);
  };

  const cancelEditing = () => {
    setEditingCSQ(null);
    setEditingName("");
  };

  const saveCSQName = (csqId: string) => {
    if (!editingName.trim()) {
      toast({
        title: "Invalid Name",
        description: "CSQ name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ csqId, name: editingName.trim() });
  };

  const handleView = (csq: CSQ) => {
    setSelectedCSQ(csq);
  };

  const toggleCSQSelection = (csqId: string) => {
    const newSelection = new Set(selectedCSQs);
    if (newSelection.has(csqId)) {
      newSelection.delete(csqId);
    } else {
      newSelection.add(csqId);
    }
    setSelectedCSQs(newSelection);
  };

  const selectAllCSQs = () => {
    setSelectedCSQs(new Set(filteredCSQs.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedCSQs(new Set());
  };

  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!targetConnectionId) {
        throw new Error('Target system is required');
      }

      const selectedCSQData = csqs.filter(c => selectedCSQs.has(c.id));
      
      const migrationJob = {
        configurationId: null,
        targetConnectionId,
        status: 'pending' as const,
        progress: 0,
        projectId: currentProjectId,
        settings: {
          type: 'csqs',
          csqs: selectedCSQData,
          options: migrationOptions,
        },
      };

      const response = await apiRequest('POST', '/api/migrations', migrationJob);
      return response.json();
    },
    onSuccess: () => {
      setShowProvisionDialog(false);
      setSelectedCSQs(new Set());
      setTargetConnectionId("");
      queryClient.invalidateQueries({ queryKey: ['/api/migrations/active', { projectId: currentProjectId }] });
      toast({
        title: "Migration Started",
        description: `Started provisioning ${selectedCSQs.size} CSQs to target system.`,
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

  const resolveSkillName = (skillId: string | number): string => {
    const skill = skills.find(s => s.skillId === Number(skillId) || s.skillId === String(skillId));
    return skill ? skill.skillName : `Skill ${skillId}`;
  };

  const resolveResourceGroupName = (resourceGroupId: string | number): string => {
    const rg = resourceGroups.find(rg => rg.resourceGroupId === Number(resourceGroupId) || rg.resourceGroupId === String(resourceGroupId));
    return rg ? rg.name : `Resource Group ${resourceGroupId}`;
  };

  const generateUpdatedXmlView = (csq: CSQ): string => {
    const metadata = csq.metadata as any;
    const originalData = metadata?.originalData;
    
    if (originalData?.originalXml) {
      const skillsInCSQ = originalData.skills || [];
      let updatedXml = originalData.originalXml;
      
      if (csqSkills && csqSkills.length > 0) {
        csqSkills.forEach((csqSkill: any) => {
          const skillId = csqSkill.skillId;
          const currentName = csqSkill.skillName;
          const originalSkill = skillsInCSQ.find((s: any) => String(s.skillId || s.id) === String(skillId));
          const originalName = originalSkill?.name || originalSkill?.skillName;
          
          if (currentName && originalName && currentName !== originalName) {
            const namePattern = new RegExp(`name="${originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
            updatedXml = updatedXml.replace(namePattern, `name="${currentName}"`);
          }
        });
      }
      
      const resourceGroupsInCSQ = originalData.resourceGroups || [];
      resourceGroupsInCSQ.forEach((csqRg: any) => {
        const rgId = csqRg.resourceGroupId || csqRg.id;
        const originalName = csqRg.name;
        const currentRg = resourceGroups.find(rg => String(rg.resourceGroupId) === String(rgId));
        const currentName = currentRg?.name;
        
        if (currentName && currentName !== originalName) {
          const namePattern = new RegExp(`name="${originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
          updatedXml = updatedXml.replace(namePattern, `name="${currentName}"`);
        }
      });
      
      return updatedXml;
    }

    return `<csq id="${csq.csqId}" name="${csq.name}">
  ${csq.description ? `<description>${csq.description}</description>` : ''}
</csq>`;
  };

  const generateOriginalXmlView = (csq: CSQ): string => {
    const metadata = csq.metadata as any;
    
    if (metadata?.originalXml) {
      return metadata.originalXml;
    }
    
    const originalData = metadata?.originalData;
    if (!originalData) {
      return `<csq id="${csq.csqId}" name="${csq.name}">
  ${csq.description ? `<description>${csq.description}</description>` : ''}
</csq>`;
    }

    if (originalData.originalXml) {
      return originalData.originalXml;
    }

    let originalXml = `<csq id="${originalData.csqId || csq.csqId}" name="${originalData.name || csq.name}">`;
    
    if (originalData.description) {
      originalXml += `
  <description>${originalData.description}</description>`;
    }

    if (originalData.skills && Array.isArray(originalData.skills)) {
      originalXml += `
  <skills>`;
      originalData.skills.forEach((skill: any) => {
        const skillId = skill.skillId || skill.id;
        const skillName = skill.name || `Skill ${skillId}`;
        originalXml += `
    <skill skillId="${skillId}" name="${skillName}" />`;
      });
      originalXml += `
  </skills>`;
    }

    if (originalData.resourceGroups && Array.isArray(originalData.resourceGroups)) {
      originalXml += `
  <resourceGroups>`;
      originalData.resourceGroups.forEach((rg: any) => {
        const rgId = rg.resourceGroupId || rg.id;
        const rgName = rg.name || `Resource Group ${rgId}`;
        originalXml += `
    <resourceGroup resourceGroupId="${rgId}" name="${rgName}" />`;
      });
      originalXml += `
  </resourceGroups>`;
    }

    if (originalData.settings && Object.keys(originalData.settings).length > 0) {
      originalXml += `
  <settings>`;
      Object.entries(originalData.settings).forEach(([key, value]) => {
        originalXml += `
    <setting name="${key}">${value}</setting>`;
      });
      originalXml += `
  </settings>`;
    }

    originalXml += `
</csq>`;
    
    return originalXml;
  };

  const handleEdit = (csq: CSQ) => {
    startEditing(csq);
  };

  const filteredCSQs = csqs.filter(csq => 
    csq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    csq.csqId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="space-y-6">
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
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <List className="h-6 w-6 text-purple-800" />
                </div>
                <span>Contact Service Queues</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="ml-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage imported UCCX contact service queues. To import new CSQs, use the main Import tab.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                  <List className="h-6 w-6 text-purple-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total CSQs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : csqs.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <CheckCircle className="h-6 w-6 text-green-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Enabled CSQs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : csqs.filter(csq => csq.enabled).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <Search className="h-6 w-6 text-blue-800" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Filtered Results</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : filteredCSQs.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {filteredCSQs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Bulk Provision</span>
              </CardTitle>
              <CardDescription>
                Select CSQs to provision to target UCCX systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllCSQs}
                    disabled={selectedCSQs.size === filteredCSQs.length}
                  >
                    Select All ({filteredCSQs.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedCSQs.size === 0}
                  >
                    Clear Selection
                  </Button>
                  {selectedCSQs.size > 0 && (
                    <Badge variant="secondary" className="px-3 py-1">
                      {selectedCSQs.size} selected
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => setShowProvisionDialog(true)}
                  disabled={selectedCSQs.size === 0 || targetSystems.length === 0}
                  className="flex items-center space-x-2"
                  data-testid="button-provision-csqs"
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
            <CardTitle>CSQs Overview</CardTitle>
            <CardDescription>
              View and manage all contact service queues in the system
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search CSQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading CSQs...</p>
              </div>
            ) : filteredCSQs.length === 0 ? (
              <div className="text-center py-8">
                <List className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900">No CSQs Found</p>
                <p className="text-gray-600">
                  {searchTerm ? 'No CSQs match your search criteria.' : 'No CSQs have been imported yet. Use the Import tab to add CSQs.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>CSQ ID</TableHead>
                    <TableHead>Name (Editable)</TableHead>
                    <TableHead>Dependencies</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCSQs.map((csq) => (
                    <TableRow key={csq.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCSQs.has(csq.id)}
                          onCheckedChange={() => toggleCSQSelection(csq.id)}
                          data-testid={`checkbox-csq-${csq.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">
                          {csq.csqId}
                          {(csq as any).targetCSQId && (
                            <div className="text-xs text-green-600">
                              → Target: {(csq as any).targetCSQId}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingCSQ === csq.id ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="max-w-xs"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCSQName(csq.id);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                            />
                            <Button size="sm" onClick={() => saveCSQName(csq.id)} disabled={updateMutation.isPending}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelEditing}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          csq.name
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {csq.skillGroupId && (
                            <Badge variant="outline" className="text-xs">
                              Skill: {resolveSkillName(csq.skillGroupId)}
                            </Badge>
                          )}
                          {csq.resourceGroupId && (
                            <Badge variant="secondary" className="text-xs">
                              RG: {resolveResourceGroupName(csq.resourceGroupId)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {csq.sourceConnectionId ? (
                          <Badge variant="outline">API</Badge>
                        ) : (
                          <Badge variant="secondary">Import</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(csq.importedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleView(csq)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(csq)}>
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
                                <AlertDialogTitle>Delete CSQ</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the CSQ "{csq.name}"?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(csq.id)}
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
                          {migration.settings?.type === 'csqs' ? 'CSQs Migration' : 'Migration'}
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

        <Dialog open={!!selectedCSQ} onOpenChange={() => setSelectedCSQ(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>CSQ Details — {selectedCSQ?.name}</DialogTitle>
              <DialogDescription>View detailed information and raw XML for this contact service queue</DialogDescription>
            </DialogHeader>
            {selectedCSQ && (
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="xml">Raw XML</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">CSQ ID</Label>
                      <p className="text-sm text-muted-foreground">{selectedCSQ.csqId}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Name</Label>
                      <p className="text-sm text-muted-foreground">{selectedCSQ.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-muted-foreground">{selectedCSQ.description || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge variant={selectedCSQ.enabled ? "default" : "secondary"}>
                        {selectedCSQ.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Source</Label>
                      <Badge variant={selectedCSQ.sourceConnectionId ? "outline" : "secondary"}>
                        {selectedCSQ.sourceConnectionId ? "API" : "XML Import"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Imported At</Label>
                      <p className="text-sm text-muted-foreground">{new Date(selectedCSQ.importedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="xml">
                  <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                    <XmlDisplay id={selectedCSQ.id} type="csqs" projectId={currentProjectId} />
                  </pre>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Provision CSQs to Target System</DialogTitle>
              <DialogDescription>
                Configure the target system for {selectedCSQs.size} selected CSQs.
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
    </div>
  );
}
