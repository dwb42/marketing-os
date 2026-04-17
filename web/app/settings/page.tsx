"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { IdChip } from "@/components/common/id-chip";
import { useApiConfig } from "@/hooks/use-api-config";
import { useSelectedWorkspace, useSelectedProduct } from "@/hooks/use-workspace";
import { DEFAULT_API_BASE } from "@/lib/config";
import { Check, AlertTriangle } from "lucide-react";
import { getApiBase, getToken } from "@/lib/config";

export default function SettingsPage() {
  const { apiBase, token, update } = useApiConfig();
  const { workspaceId, setWorkspaceId, workspaces } = useSelectedWorkspace();
  const { productId, setProductId, products } = useSelectedProduct(workspaceId);

  const [draftApiBase, setDraftApiBase] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [ping, setPing] = useState<null | "ok" | "fail">(null);
  const [pingDetail, setPingDetail] = useState<string>("");

  useEffect(() => {
    setDraftApiBase(apiBase);
    setDraftToken(token);
  }, [apiBase, token]);

  const save = () => {
    update({ apiBase: draftApiBase, token: draftToken });
  };

  const testConnection = async () => {
    setPing(null);
    setPingDetail("");
    try {
      const headers: Record<string, string> = {};
      const t = getToken();
      if (t) headers["Authorization"] = `Bearer ${t}`;
      const res = await fetch(`${getApiBase()}/health`, { headers });
      if (!res.ok) {
        setPing("fail");
        setPingDetail(`HTTP ${res.status}`);
        return;
      }
      setPing("ok");
      setPingDetail("API erreichbar");
    } catch (err) {
      setPing("fail");
      setPingDetail(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Einstellungen"
        description="Verbindung zur Marketing-OS-API und aktiver Workspace/Product."
      />

      <Card>
        <CardHeader>
          <CardTitle>API-Verbindung</CardTitle>
          <CardDescription>
            Basis-URL und (optional) Bearer-Token. Persistiert im localStorage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              API Base URL
            </label>
            <Input
              value={draftApiBase}
              onChange={(e) => setDraftApiBase(e.target.value)}
              placeholder={DEFAULT_API_BASE}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Bearer-Token (optional)
            </label>
            <Input
              value={draftToken}
              onChange={(e) => setDraftToken(e.target.value)}
              placeholder="leer = Open-Dev-Modus"
              type="password"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Wird als <code className="font-mono">Authorization: Bearer …</code>{" "}
              gesendet. Bei leerem Wert läuft die API im Open-Dev-Modus.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={save}>Speichern</Button>
            <Button variant="outline" onClick={testConnection}>
              Verbindung testen
            </Button>
            {ping === "ok" ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={14} /> {pingDetail}
              </span>
            ) : null}
            {ping === "fail" ? (
              <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle size={14} /> {pingDetail}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktiver Workspace</CardTitle>
          <CardDescription>
            Wird für alle Listen- und Detail-Abfragen verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Workspace
            </label>
            <Select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            >
              {workspaces.length === 0 ? (
                <option value="">— keine gefunden —</option>
              ) : null}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.slug}
                </option>
              ))}
            </Select>
            {workspaceId ? (
              <div className="pt-1">
                <IdChip id={workspaceId} />
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Aktives Product (für Outcome-Views)
            </label>
            <Select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={!workspaceId}
            >
              {products.length === 0 ? (
                <option value="">— keine gefunden —</option>
              ) : null}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {productId ? (
              <div className="pt-1">
                <IdChip id={productId} />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
