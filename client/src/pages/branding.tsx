import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/branding-context";
import { Upload, RotateCcw, Save, Image } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Branding() {
  const { branding, refresh } = useBranding();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [appName, setAppName] = useState(branding.appName);
  const [appSubtitle, setAppSubtitle] = useState(branding.appSubtitle);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(branding.logoDataUrl);
  const [saving, setSaving] = useState(false);

  // Sync local state when branding context loads
  useState(() => {
    setAppName(branding.appName);
    setAppSubtitle(branding.appSubtitle);
    setLogoDataUrl(branding.logoDataUrl);
  });

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/settings/branding", {
        appName: appName.trim() || "UCCX Migration Tool",
        appSubtitle: appSubtitle.trim(),
        logoDataUrl,
      });
      refresh();
      toast({ title: "Branding updated", description: "Changes are live across the application." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/settings/branding", {
        appName: "UCCX Migration Tool",
        appSubtitle: "Enterprise Configuration Management",
        logoDataUrl: null,
      });
      setAppName("UCCX Migration Tool");
      setAppSubtitle("Enterprise Configuration Management");
      setLogoDataUrl(null);
      refresh();
      toast({ title: "Branding reset to defaults" });
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Branding</h2>
        <p className="text-sm text-gray-600">Customize the application logo and banner displayed in the header.</p>
      </div>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="w-10 h-10 bg-cisco-blue rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="Logo" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14l3-3 3 3L20 7v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7l7 7z"/>
                </svg>
              )}
            </div>
            <div>
              <p className="text-base font-medium text-gray-900">{appName || "UCCX Migration Tool"}</p>
              <p className="text-sm text-gray-500">{appSubtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="Current logo" className="w-full h-full object-cover" />
              ) : (
                <Image className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
              {logoDataUrl && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setLogoDataUrl(null)}>
                  Remove logo
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />
          </div>
          <p className="text-xs text-gray-500">PNG, JPG, or SVG. Max 2 MB. Displays at 40×40 px in the header.</p>
        </CardContent>
      </Card>

      {/* Text */}
      <Card>
        <CardHeader><CardTitle>Banner Text</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1 block">Application Name</Label>
            <Input
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="UCCX Migration Tool"
              maxLength={60}
            />
          </div>
          <div>
            <Label className="mb-1 block">Subtitle</Label>
            <Input
              value={appSubtitle}
              onChange={e => setAppSubtitle(e.target.value)}
              placeholder="Enterprise Configuration Management"
              maxLength={80}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-cisco-blue hover:bg-cisco-dark">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
