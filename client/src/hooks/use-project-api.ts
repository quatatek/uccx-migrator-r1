import { useCallback } from "react";
import { useProject } from "@/contexts/project-context";
import { appendProjectId, projectApiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth-token";

export function useProjectApi() {
  const { currentProjectId } = useProject();

  const getProjectUrl = useCallback(
    (url: string) => appendProjectId(url, currentProjectId),
    [currentProjectId]
  );

  const projectFetch = useCallback(
    async (url: string) => {
      const projectUrl = appendProjectId(url, currentProjectId);
      const response = await fetch(projectUrl, {
        credentials: "include",
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      return response.json();
    },
    [currentProjectId]
  );

  const projectRequest = useCallback(
    async (method: string, url: string, data?: Record<string, unknown> | FormData) => {
      return projectApiRequest(method, url, currentProjectId, data);
    },
    [currentProjectId]
  );

  const getProjectQueryKey = useCallback(
    (baseKey: string | string[]) => {
      const keys = Array.isArray(baseKey) ? baseKey : [baseKey];
      return [...keys, { projectId: currentProjectId }];
    },
    [currentProjectId]
  );

  return {
    currentProjectId,
    hasProject: !!currentProjectId,
    getProjectUrl,
    projectFetch,
    projectRequest,
    getProjectQueryKey,
  };
}
