import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useProject } from "@/contexts/project-context";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FolderOpen, 
  Plus, 
  Trash2, 
  Users, 
  ArrowRight, 
  Edit, 
  Shield,
  Server,
  CheckCircle,
  XCircle,
  Layers,
  UserCog,
  Phone,
  AppWindow,
  Workflow
} from "lucide-react";

interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerUsername: string;
  isActive: boolean;
  logLevel: 'error' | 'warning' | 'info' | 'debug';
  createdAt: string;
  stats: {
    sourceConnections: number;
    destinationConnections: number;
    skills: number;
    resourceGroups: number;
    resources: number;
    teams: number;
    csqs: number;
    applications: number;
    triggers: number;
    successfulMigrations: number;
    failedMigrations: number;
  };
}

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  canView: boolean;
  canManageConnections: boolean;
  canImport: boolean;
  canUpdate: boolean;
  canMigrate: boolean;
  isAdmin: boolean;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export default function Projects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { selectProject, refetchProjects } = useProject();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectLogLevel, setNewProjectLogLevel] = useState<'error' | 'warning' | 'info' | 'debug'>('info');

  const { data: projects = [], isLoading } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects/with-stats'],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const { data: projectMembers = [], refetch: refetchMembers } = useQuery<ProjectMember[]>({
    queryKey: ['/api/projects', selectedProject?.id, 'members'],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const response = await fetch(`/api/projects/${selectedProject.id}/members`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch members');
      return response.json();
    },
    enabled: !!selectedProject?.id && isPermissionsDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/projects', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Project created successfully" });
      setIsCreateDialogOpen(false);
      setNewProjectName("");
      setNewProjectDescription("");
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/with-stats'] });
      refetchProjects();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create project", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description?: string; logLevel: string }) => {
      const response = await apiRequest('PUT', `/api/projects/${data.id}`, { name: data.name, description: data.description, logLevel: data.logLevel });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Project updated successfully" });
      setIsEditDialogOpen(false);
      setSelectedProject(null);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/with-stats'] });
      refetchProjects();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update project", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Project deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedProject(null);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/with-stats'] });
      refetchProjects();
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete project", description: error.message, variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: { projectId: string; username: string }) => {
      const response = await apiRequest('POST', `/api/projects/${data.projectId}/members`, { username: data.username });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Member added successfully" });
      refetchMembers();
    },
    onError: (error: any) => {
      toast({ title: "Failed to add member", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async (data: { projectId: string; memberId: string; permissions: Partial<ProjectMember> }) => {
      const response = await apiRequest('PATCH', `/api/projects/${data.projectId}/members/${data.memberId}`, data.permissions);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Permissions updated" });
      refetchMembers();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update permissions", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (data: { projectId: string; memberId: string }) => {
      await apiRequest('DELETE', `/api/projects/${data.projectId}/members/${data.memberId}`);
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      refetchMembers();
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove member", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectProject = async (project: ProjectWithStats) => {
    selectProject(String(project.id));
    navigate("/dashboard");
  };

  const handleEditProject = (project: ProjectWithStats) => {
    setSelectedProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || "");
    setNewProjectLogLevel(project.logLevel || 'info');
    setIsEditDialogOpen(true);
  };

  const handleDeleteProject = (project: ProjectWithStats) => {
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  };

  const handleManagePermissions = (project: ProjectWithStats) => {
    setSelectedProject(project);
    setIsPermissionsDialogOpen(true);
  };

  const togglePermission = (member: ProjectMember, permission: keyof ProjectMember) => {
    if (selectedProject) {
      updateMemberMutation.mutate({
        projectId: selectedProject.id,
        memberId: member.id,
        permissions: { [permission]: !member[permission] },
      });
    }
  };

  const existingMemberIds = projectMembers.map(m => m.userId);
  const availableUsers = allUsers.filter(u => !existingMemberIds.includes(u.id));

  const getTotalConfigs = (stats: ProjectWithStats['stats']) => {
    return stats.skills + stats.resourceGroups + stats.resources + stats.teams + stats.csqs + stats.applications + stats.triggers;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-2">Manage your UCCX migration projects</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-project">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-100 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Yet</h3>
            <p className="text-gray-600 mb-4">Create your first project to start managing UCCX configurations.</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow" data-testid={`card-project-${project.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <FolderOpen className="h-6 w-6 text-cisco-blue flex-shrink-0" />
                      <h3 className="text-xl font-semibold text-gray-900 truncate">{project.name}</h3>
                      <Badge variant={project.isActive ? "default" : "secondary"}>
                        {project.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Owner: <span className="font-medium">{project.ownerUsername}</span>
                      </span>
                      {project.description && (
                        <span className="text-gray-400">|</span>
                      )}
                      {project.description && (
                        <span className="truncate max-w-md">{project.description}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <Server className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-gray-500">Connections</p>
                          <p className="font-medium text-sm" data-testid={`stat-connections-${project.id}`}>
                            {project.stats.sourceConnections} / {project.stats.destinationConnections}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <Layers className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-gray-500">Total Configs</p>
                          <p className="font-medium text-sm" data-testid={`stat-total-${project.id}`}>
                            {getTotalConfigs(project.stats)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <UserCog className="h-4 w-4 text-indigo-500" />
                        <div>
                          <p className="text-xs text-gray-500">Skills / RG</p>
                          <p className="font-medium text-sm">
                            {project.stats.skills} / {project.stats.resourceGroups}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <Phone className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-xs text-gray-500">CSQs / Teams</p>
                          <p className="font-medium text-sm">
                            {project.stats.csqs} / {project.stats.teams}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-xs text-gray-500">Successful</p>
                          <p className="font-medium text-sm text-green-700" data-testid={`stat-success-${project.id}`}>
                            {project.stats.successfulMigrations}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-xs text-gray-500">Failed</p>
                          <p className="font-medium text-sm text-red-700" data-testid={`stat-failed-${project.id}`}>
                            {project.stats.failedMigrations}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:flex-col lg:items-end">
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEditProject(project)}
                        title="Edit Project"
                        data-testid={`button-edit-project-${project.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleManagePermissions(project)}
                        title="Manage Permissions"
                        data-testid={`button-permissions-project-${project.id}`}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteProject(project)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete Project"
                        data-testid={`button-delete-project-${project.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      onClick={() => handleSelectProject(project)}
                      className="whitespace-nowrap"
                      data-testid={`button-open-project-${project.id}`}
                    >
                      Open Project
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Create a new project to organize your UCCX configurations.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Project Name</Label>
              <Input
                id="create-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
                data-testid="input-create-project-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-description">Description (optional)</Label>
              <Textarea
                id="create-description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Enter project description"
                data-testid="input-create-project-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createMutation.mutate({ name: newProjectName, description: newProjectDescription || undefined })}
              disabled={!newProjectName.trim() || createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update your project details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                data-testid="input-edit-project-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                data-testid="input-edit-project-description"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-log-level">Minimum Log Level</Label>
              <Select value={newProjectLogLevel} onValueChange={(v) => setNewProjectLogLevel(v as any)}>
                <SelectTrigger id="edit-log-level" data-testid="select-log-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">Error — only failures</SelectItem>
                  <SelectItem value="warning">Warning — failures &amp; warnings</SelectItem>
                  <SelectItem value="info">Info — standard activity (default)</SelectItem>
                  <SelectItem value="debug">Debug — everything</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Log entries below this level will not be recorded for this project.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedProject && updateMutation.mutate({ 
                id: selectedProject.id, 
                name: newProjectName, 
                description: newProjectDescription || undefined,
                logLevel: newProjectLogLevel,
              })}
              disabled={!newProjectName.trim() || updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This will permanently delete all configurations, connections, and data associated with this project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProject && deleteMutation.mutate(selectedProject.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Project Permissions</DialogTitle>
            <DialogDescription>
              Control who can access "{selectedProject?.name}" and what they can do.
            </DialogDescription>
          </DialogHeader>
          
          {availableUsers.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <select 
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                id="add-member-select"
                data-testid="select-add-member"
              >
                <option value="">Select a user to add...</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.username}>{user.username}</option>
                ))}
              </select>
              <Button 
                onClick={() => {
                  const select = document.getElementById('add-member-select') as HTMLSelectElement;
                  if (select.value && selectedProject) {
                    addMemberMutation.mutate({ projectId: selectedProject.id, username: select.value });
                    select.value = "";
                  }
                }}
                disabled={addMemberMutation.isPending}
                data-testid="button-add-member"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-center">View</TableHead>
                <TableHead className="text-center">Connections</TableHead>
                <TableHead className="text-center">Import</TableHead>
                <TableHead className="text-center">Update</TableHead>
                <TableHead className="text-center">Migrate</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{member.user?.username || `User ${member.userId}`}</span>
                      {member.user?.role === 'admin' && (
                        <Badge variant="outline" className="text-xs">Admin</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={member.canView}
                      onCheckedChange={() => togglePermission(member, 'canView')}
                      data-testid={`checkbox-view-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={member.canManageConnections}
                      onCheckedChange={() => togglePermission(member, 'canManageConnections')}
                      data-testid={`checkbox-connections-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={member.canImport}
                      onCheckedChange={() => togglePermission(member, 'canImport')}
                      data-testid={`checkbox-import-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={member.canUpdate}
                      onCheckedChange={() => togglePermission(member, 'canUpdate')}
                      data-testid={`checkbox-update-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={member.canMigrate}
                      onCheckedChange={() => togglePermission(member, 'canMigrate')}
                      data-testid={`checkbox-migrate-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={member.isAdmin}
                      onCheckedChange={() => togglePermission(member, 'isAdmin')}
                      data-testid={`checkbox-admin-${member.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => selectedProject && removeMemberMutation.mutate({ projectId: selectedProject.id, memberId: member.id })}
                      className="text-red-600 hover:text-red-700"
                      data-testid={`button-remove-member-${member.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {projectMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No members added yet. Add users above to grant them access.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
