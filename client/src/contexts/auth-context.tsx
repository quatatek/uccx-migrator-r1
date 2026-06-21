import { createContext, useContext, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuthToken, removeAuthToken, getAuthHeaders } from "@/lib/auth-token";
import type { SafeUser } from "@shared/schema";

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  
  const { data, isLoading, refetch } = useQuery<{ user: SafeUser } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { ...getAuthHeaders() },
      });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    retry: false,
  });

  const user = data?.user || null;
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", { username, password });
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.token) {
        setAuthToken(data.token);
      }
      if (data?.user) {
        queryClient.setQueryData(["/api/auth/me"], { user: data.user });
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return response.json();
    },
    onSuccess: () => {
      removeAuthToken();
      queryClient.clear();
    },
  });

  const login = useCallback(async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  }, [loginMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
