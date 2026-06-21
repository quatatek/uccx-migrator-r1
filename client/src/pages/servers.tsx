import { useState } from "react";
import { getAuthHeaders } from "@/lib/auth-token";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Settings, Trash2, TestTube, CheckCircle, XCircle, Globe, Server, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useProject } from "@/contexts/project-context";

// Form schema for server configuration
const serverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.number().min(1).max(65535),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  useHttps: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

type ServerForm = z.infer<typeof serverSchema>;

interface UccxConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  useHttps?: boolean;
  isSource: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Servers() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<UccxConnection | null>(null);
  const [serverType, setServerType] = useState<'source' | 'target'>('source');
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentProject } = useProject();

  // Fetch source systems
  const { data: sourceSystems = [], isLoading: loadingSource } = useQuery<UccxConnection[]>({
    queryKey: ['/api/uccx-connections/source', { projectId: currentProject?.id }],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const response = await fetch(`/api/uccx-connections/source?projectId=${currentProject.id}`);
      if (!response.ok) throw new Error('Failed to fetch source systems');
      return response.json();
    },
    enabled: !!currentProject?.id,
  });

  // Fetch target systems
  const { data: targetSystems = [], isLoading: loadingTarget } = useQuery<UccxConnection[]>({
    queryKey: ['/api/uccx-connections/target', { projectId: currentProject?.id }],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      const response = await fetch(`/api/uccx-connections/target?projectId=${currentProject.id}`);
      if (!response.ok) throw new Error('Failed to fetch target systems');
      return response.json();
    },
    enabled: !!currentProject?.id,
  });

  // Save server mutation
  const saveConnectionMutation = useMutation({
    mutationFn: async (data: ServerForm & { id?: string; isSource: boolean }) => {
      if (!currentProject?.id) throw new Error('No project selected');
      
      const url = data.id 
        ? `/api/uccx-connections/${data.id}?projectId=${currentProject.id}` 
        : `/api/uccx-connections?projectId=${currentProject.id}`;
      const method = data.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...data, projectId: currentProject.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save server');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/uccx-connections/source', { projectId: currentProject?.id }] });
      queryClient.invalidateQueries({ queryKey: ['/api/uccx-connections/target', { projectId: currentProject?.id }] });
      setIsAddDialogOpen(false);
      setEditingConnection(null);
      toast({
        title: editingConnection ? "Server Updated" : "Server Added",
        description: "Configuration saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save server",
        variant: "destructive",
      });
    },
  });

  // Delete server mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentProject?.id) throw new Error('No project selected');
      const response = await fetch(`/api/uccx-connections/${id}?projectId=${currentProject.id}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete server');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uccx-connections/source', { projectId: currentProject?.id }] });
      queryClient.invalidateQueries({ queryKey: ['/api/uccx-connections/target', { projectId: currentProject?.id }] });
      toast({
        title: "Server Deleted",
        description: "Configuration removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete server",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentProject?.id) throw new Error('No project selected');
      const response = await fetch(`/api/uccx-connections/${id}/test?projectId=${currentProject.id}`, { method: 'POST', headers: { ...getAuthHeaders() } });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setTestingConnection(null);
      toast({
        title: "Connection Test Successful",
        description: `Successfully connected to ${data.serverInfo || 'UCCX system'}`,
      });
    },
    onError: (error) => {
      setTestingConnection(null);
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "Failed to connect to UCCX system",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ServerForm>({
    resolver: zodResolver(serverSchema),
    defaultValues: {
      name: "",
      host: "",
      port: 443,
      username: "",
      password: "",
      useHttps: true,
      isActive: true,
    },
  });

  const handleAddNew = (type: 'source' | 'target') => {
    form.reset();
    setEditingConnection(null);
    setServerType(type);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (connection: UccxConnection) => {
    form.reset({
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      useHttps: connection.useHttps ?? true,
      isActive: connection.isActive,
    });
    setEditingConnection(connection);
    setServerType(connection.isSource ? 'source' : 'target');
    setIsAddDialogOpen(true);
  };

  const handleTestConnection = (id: string) => {
    setTestingConnection(id);
    testConnectionMutation.mutate(id);
  };

  const onSubmit = (data: ServerForm) => {
    saveConnectionMutation.mutate({
      ...data,
      id: editingConnection?.id,
      isSource: editingConnection ? editingConnection.isSource : serverType === 'source',
    });
  };

  const getConnectionStatus = (connection: UccxConnection) => {
    if (!connection.isActive) {
      return { status: "inactive", icon: XCircle, color: "text-gray-500" };
    }
    return { status: "ready", icon: CheckCircle, color: "text-green-500" };
  };

  const ServerTable = ({ systems, isLoading, emptyMessage, type }: { 
    systems: UccxConnection[]; 
    isLoading: boolean; 
    emptyMessage: string;
    type: 'source' | 'target';
  }) => (
    <>
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cisco-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Loading servers...</p>
        </div>
      ) : systems.length === 0 ? (
        <div className="text-center py-8">
          <Server className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900">No Servers Configured</p>
          <p className="text-gray-600 mb-4">{emptyMessage}</p>
          <Button onClick={() => handleAddNew(type)} className="bg-cisco-blue hover:bg-cisco-dark">
            <Plus className="h-4 w-4 mr-2" />
            Add {type === 'source' ? 'Source' : 'Target'} Server
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems.map((system) => {
              const { status, icon: StatusIcon, color } = getConnectionStatus(system);
              return (
                <TableRow key={system.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{system.name}</p>
                      <p className="text-sm text-gray-500">
                        Added {new Date(system.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-mono text-sm">{system.host}:{system.port}</p>
                      <p className="text-xs text-gray-500">User: {system.username}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${color}`} />
                      <Badge variant={system.isActive ? "default" : "secondary"}>
                        {system.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {system.useHttps !== false ? "HTTPS" : "HTTP"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection(system.id)}
                        disabled={testingConnection === system.id}
                        data-testid={`button-test-${system.id}`}
                      >
                        {testingConnection === system.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600"></div>
                        ) : (
                          <TestTube className="h-3 w-3" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(system)}
                        data-testid={`button-edit-${system.id}`}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteConnectionMutation.mutate(system.id)}
                        className="text-red-600 hover:text-red-800"
                        data-testid={`button-delete-${system.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">UCCX Servers</h1>
          <p className="text-gray-600 mt-2">
            Manage source and target UCCX systems for configuration import and migration
          </p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Selected</h3>
            <p className="text-gray-600">
              Please select a project from the header to manage UCCX server connections.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">UCCX Servers</h1>
        <p className="text-gray-600 mt-2">
          Manage source and target UCCX systems for configuration import and migration
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <Server className="h-6 w-6 text-blue-800" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Source Systems</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingSource ? '...' : sourceSystems.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <Globe className="h-6 w-6 text-purple-800" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Target Systems</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingTarget ? '...' : targetSystems.length}
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
                <p className="text-sm font-medium text-gray-600">Active Servers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(loadingSource || loadingTarget) ? '...' : 
                    sourceSystems.filter(s => s.isActive).length + targetSystems.filter(s => s.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <Settings className="h-6 w-6 text-orange-800" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Systems</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(loadingSource || loadingTarget) ? '...' : sourceSystems.length + targetSystems.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Source and Target */}
      <Tabs defaultValue="source" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="source" data-testid="tab-source-servers">
            <Server className="h-4 w-4 mr-2" />
            Source Systems
          </TabsTrigger>
          <TabsTrigger value="target" data-testid="tab-target-servers">
            <Globe className="h-4 w-4 mr-2" />
            Target Systems
          </TabsTrigger>
        </TabsList>

        <TabsContent value="source" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Source Systems ({sourceSystems.length})</CardTitle>
                <CardDescription>
                  UCCX systems to import configurations from via API
                </CardDescription>
              </div>
              <Button onClick={() => handleAddNew('source')} className="bg-cisco-blue hover:bg-cisco-dark" data-testid="button-add-source">
                <Plus className="h-4 w-4 mr-2" />
                Add Source System
              </Button>
            </CardHeader>
            <CardContent>
              <ServerTable 
                systems={sourceSystems} 
                isLoading={loadingSource} 
                emptyMessage="Add your first source UCCX system to import configurations via API"
                type="source"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="target" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Target Systems ({targetSystems.length})</CardTitle>
                <CardDescription>
                  UCCX systems to migrate and deploy configurations to
                </CardDescription>
              </div>
              <Button onClick={() => handleAddNew('target')} className="bg-purple-600 hover:bg-purple-700" data-testid="button-add-target">
                <Plus className="h-4 w-4 mr-2" />
                Add Target System
              </Button>
            </CardHeader>
            <CardContent>
              <ServerTable 
                systems={targetSystems} 
                isLoading={loadingTarget} 
                emptyMessage="Add your first target UCCX system to begin migration setup"
                type="target"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? 'Edit Server' : `Add ${serverType === 'source' ? 'Source' : 'Target'} Server`}
            </DialogTitle>
            <DialogDescription>
              Configure UCCX {serverType} system connection details
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Production UCCX" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host/IP Address</FormLabel>
                    <FormControl>
                      <Input placeholder="uccx.example.com" {...field} data-testid="input-host" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-port"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="admin" {...field} data-testid="input-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="useHttps"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Use HTTPS</FormLabel>
                      <FormDescription>
                        Connect securely using HTTPS protocol
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-https"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable this connection for use
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel-dialog"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={saveConnectionMutation.isPending}
                  data-testid="button-save-server"
                >
                  {saveConnectionMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
