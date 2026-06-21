import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface ProjectPermissions {
  projectId: string;
  isOwner: boolean;
  canView: boolean;
  canManageConnections: boolean;
  canImport: boolean;
  canUpdate: boolean;
  canMigrate: boolean;
  isAdmin: boolean;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;
  permissions: ProjectPermissions | null;
  isLoading: boolean;
  hasPermission: (permission: 'view' | 'manageConnections' | 'import' | 'update' | 'migrate' | 'admin') => boolean;
  selectProject: (projectId: string) => void;
  createProject: (name: string, description?: string) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refetchProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = "uccx_current_project_id";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    retry: false,
  });

  const { data: currentProject, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", currentProjectId],
    enabled: !!currentProjectId,
    retry: false,
  });

  const { data: permissionsData } = useQuery<ProjectPermissions>({
    queryKey: ["/api/projects", currentProjectId, "permissions"],
    enabled: !!currentProjectId,
    retry: false,
  });

  const createProjectMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/projects", { name, description });
      return response.json();
    },
    onSuccess: (newProject: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setCurrentProjectId(newProject.id);
      localStorage.setItem(STORAGE_KEY, newProject.id);
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
      const response = await apiRequest("PUT", `/api/projects/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (currentProjectId) {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentProjectId(null);
      }
    },
  });

  useEffect(() => {
    if (!projectsLoading && projects.length > 0 && !currentProjectId) {
      const firstProject = projects[0];
      setCurrentProjectId(firstProject.id);
      localStorage.setItem(STORAGE_KEY, firstProject.id);
    }
  }, [projects, projectsLoading, currentProjectId]);

  useEffect(() => {
    if (currentProjectId && !projectsLoading && projects.length > 0) {
      const projectExists = projects.some(p => p.id === currentProjectId);
      if (!projectExists) {
        const firstProject = projects[0];
        setCurrentProjectId(firstProject.id);
        localStorage.setItem(STORAGE_KEY, firstProject.id);
      }
    }
  }, [currentProjectId, projects, projectsLoading]);

  const selectProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    localStorage.setItem(STORAGE_KEY, projectId);
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
  }, [queryClient]);

  const createProject = useCallback(async (name: string, description?: string) => {
    return createProjectMutation.mutateAsync({ name, description });
  }, [createProjectMutation]);

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    return updateProjectMutation.mutateAsync({ id, data });
  }, [updateProjectMutation]);

  const deleteProject = useCallback(async (id: string) => {
    await deleteProjectMutation.mutateAsync(id);
  }, [deleteProjectMutation]);

  const hasPermission = useCallback((permission: 'view' | 'manageConnections' | 'import' | 'update' | 'migrate' | 'admin') => {
    if (!permissionsData) return false;
    
    if (permissionsData.isAdmin || permissionsData.isOwner) return true;
    
    switch (permission) {
      case 'view':
        return permissionsData.canView;
      case 'manageConnections':
        return permissionsData.canManageConnections;
      case 'import':
        return permissionsData.canImport;
      case 'update':
        return permissionsData.canUpdate;
      case 'migrate':
        return permissionsData.canMigrate;
      case 'admin':
        return permissionsData.isAdmin;
      default:
        return false;
    }
  }, [permissionsData]);

  const isLoading = projectsLoading || (!!currentProjectId && projectLoading);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject: currentProject || null,
        currentProjectId,
        permissions: permissionsData || null,
        isLoading,
        hasPermission,
        selectProject,
        createProject,
        updateProject,
        deleteProject,
        refetchProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
