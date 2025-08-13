import { invoke } from "@tauri-apps/api/core";
import { Copy, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";

import type { EnvConfig } from "@/bindings/EnvConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EnvSettings() {
  const [config, setConfig] = useState<EnvConfig>({
    PIXIV_ID: "",
    PIXIV_PW: "",
    REFRESH_TOKEN: "",
    INTERVAL_MILL_SEC: "1000",
    DB_NAME: "pixiv_def",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        const initialConfig = await invoke<EnvConfig>(
          "get_environment_variables"
        );
        if (initialConfig) {
          setConfig(initialConfig);
        }
      } catch (error) {
        console.error("Failed to load initial settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  };

  const generateEnvFile = () => {
    return Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generateEnvFile());
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await invoke("save_environment_variables", { config });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-gray-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading settings...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-center">
            Environment Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="pixiv-id" className="text-sm font-medium">
                PIXIV ID
              </Label>
              <Input
                id="pixiv-id"
                value={config.PIXIV_ID}
                onChange={(e) => handleChange("PIXIV_ID", e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="pixiv-pw" className="text-sm font-medium">
                PIXIV Password
              </Label>
              <div className="relative mt-1">
                <Input
                  id="pixiv-pw"
                  type={showPassword ? "text" : "password"}
                  value={config.PIXIV_PW}
                  onChange={(e) => handleChange("PIXIV_PW", e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="refresh-token" className="text-sm font-medium">
                Refresh Token
              </Label>
              <div className="relative mt-1">
                <Input
                  id="refresh-token"
                  type={showToken ? "text" : "password"}
                  value={config.REFRESH_TOKEN}
                  onChange={(e) =>
                    handleChange("REFRESH_TOKEN", e.target.value)
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="interval" className="text-sm font-medium">
                  Interval (ms)
                </Label>
                <Input
                  id="interval"
                  value={config.INTERVAL_MILL_SEC}
                  onChange={(e) =>
                    handleChange("INTERVAL_MILL_SEC", e.target.value)
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="db-name" className="text-sm font-medium">
                  DB Name
                </Label>
                <Input
                  id="db-name"
                  value={config.DB_NAME}
                  onChange={(e) => handleChange("DB_NAME", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <Button
              onClick={() => void saveConfig()}
              className="w-full bg-gray-600 text-gray-200"
              variant="default"
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving
                ? "Saving..."
                : saveSuccess
                ? "Saved!"
                : "Save Settings"}
            </Button>

            <Button
              onClick={() => void copyToClipboard()}
              className="w-full bg-transparent"
              variant="outline"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy .env File
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
