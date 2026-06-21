import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Settings, Trash2, TestTube, CheckCircle, XCircle, AlertTriangle, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Form schema for target system configuration
const targetSystemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.number().min(1).max(65535),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  useHttps: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

type TargetSystemForm = z.infer<typeof targetSystemSchema>;

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

export default function TargetSystems() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<UccxConnection | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch target systems (non-source connections)
  const { data: targetSystems = [], isLoading } = useQuery<UccxConnection[]>({
    queryKey: ['/api/uccx-connections/target'],
  });

  // Add/Update target system mutation
  const saveConnectionMutation = useMutation({
    mutationFn: async (data: TargetSystemForm & { id?: string }) => {
      const url = data.id ? `/api/uccx-connections/${data.id}` : '/api/uccx-connections';
      const method = data.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          isSource: false, // Always false for target systems
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save target system');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uccx-connections/target'] });
      setIsAddDialogOpen(false);
      setEditingConnection(null);
      toast({
        title: editingConnection ? "Target System Updated" : "Target System Added",
        description: "Configuration saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save target system",
        variant: "destructive",
      });
    },
  });

  // Delete target system mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/uccx-connections/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete target system');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uccx-connections/target'] });
      toast({
        title: "Target System Deleted",
        description: "Configuration removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete target system",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/uccx-connections/${id}/test`, { method: 'POST' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      setTestingConnection(null);
      toast({
        title: "Connection Test Successful",
        description: `Successfully connected to ${data.serverInfo || 'UCCX system'}`,
      });
    },
    onError: (error, variables) => {
      setTestingConnection(null);
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "Failed to connect to UCCX system",
        variant: "destructive",
      });
    },
  });

  const form = useForm<TargetSystemForm>({
    resolver: zodResolver(targetSystemSchema),
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

  const handleAddNew = () => {
    form.reset();
    setEditingConnection(null);
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
    setIsAddDialogOpen(true);
  };

  const handleTestConnection = (id: string) => {
    setTestingConnection(id);
    testConnectionMutation.mutate(id);
  };

  const onSubmit = (data: TargetSystemForm) => {
    saveConnectionMutation.mutate({
      ...data,
      id: editingConnection?.id,
    });
  };

  const getConnectionStatus = (connection: UccxConnection) => {
    if (!connection.isActive) {
      return { status: "inactive", icon: XCircle, color: "text-gray-500" };
    }
    // Could add actual connectivity status here
    return { status: "ready", icon: CheckCircle, color: "text-green-500" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Target Systems</h1>
          <p className="text-gray-600 mt-2">
            Configure UCCX target systems for migration deployments
          </p>
        </div>
        <Button onClick={handleAddNew} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Target System
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <Globe className="h-6 w-6 text-purple-800" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Systems</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : targetSystems.length}
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
                <p className="text-sm font-medium text-gray-600">Active Systems</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : targetSystems.filter(s => s.isActive).length}
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
                <p className="text-sm font-medium text-gray-600">Ready for Migration</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : targetSystems.filter(s => s.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Systems Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Target Systems ({targetSystems.length})</CardTitle>
          <CardDescription>
            Manage UCCX target systems for configuration migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading target systems...</p>
            </div>
          ) : targetSystems.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900">No Target Systems Configured</p>
              <p className="text-gray-600 mb-4">
                Add your first UCCX target system to begin migration setup
              </p>
              <Button onClick={handleAddNew} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Target System
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
                {targetSystems.map((system) => {
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
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteConnectionMutation.mutate(system.id)}
                            className="text-red-600 hover:text-red-800"
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? 'Edit Target System' : 'Add Target System'}
            </DialogTitle>
            <DialogDescription>
              Configure UCCX target system connection details for migration
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
                      <Input placeholder="Production UCCX" {...field} />
                    </FormControl>
                    <FormDescription>
                      Friendly name for this target system
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host</FormLabel>
                      <FormControl>
                        <Input placeholder="uccx.company.com" {...field} />
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
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 443)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" {...field} />
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
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="useHttps"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm">Use HTTPS</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm">Active</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={saveConnectionMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {saveConnectionMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}