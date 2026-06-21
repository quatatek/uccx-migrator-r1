import { createContext, useContext, useEffect, useState } from "react";

export interface BrandingSettings {
  appName: string;
  appSubtitle: string;
  logoDataUrl: string | null;
}

const DEFAULT: BrandingSettings = {
  appName: "UCCX Migration Tool",
  appSubtitle: "Enterprise Configuration Management",
  logoDataUrl: null,
};

const BrandingContext = createContext<{
  branding: BrandingSettings;
  refresh: () => void;
}>({ branding: DEFAULT, refresh: () => {} });

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT);

  const refresh = () => {
    fetch("/api/settings/branding", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBranding(data); })
      .catch(() => {});
  };

  useEffect(() => { refresh(); }, []);

  return (
    <BrandingContext.Provider value={{ branding, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
