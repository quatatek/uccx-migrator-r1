import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { useBranding } from "@/contexts/branding-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, Server } from "lucide-react";

const loginFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { branding } = useBranding();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/projects");
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    try {
      await login(data.username, data.password);
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      navigate("/projects");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
      
      <Card className="w-full max-w-md relative z-10 border-slate-700 bg-slate-900/90 backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center overflow-hidden">
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Server className="h-8 w-8 text-white" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">{branding.appName}</CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to access your configuration management dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Username</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        data-testid="input-username"
                        placeholder="Enter your username"
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                        disabled={isLoading}
                      />
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
                    <FormLabel className="text-slate-200">Password</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="password"
                        data-testid="input-password"
                        placeholder="Enter your password"
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                data-testid="button-login"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
