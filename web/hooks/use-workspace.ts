"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  getWorkspaceId,
  setWorkspaceId as persistWorkspaceId,
  getProductId,
  setProductId as persistProductId,
} from "@/lib/config";
import type { Workspace, Product } from "@/lib/types";

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.workspaces.list(),
    staleTime: 60_000,
  });
}

export function useSelectedWorkspace() {
  const [workspaceId, setWorkspaceIdState] = useState<string>("");

  useEffect(() => {
    setWorkspaceIdState(getWorkspaceId());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "mos_workspace_id") setWorkspaceIdState(e.newValue || "");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setWorkspaceId = useCallback((id: string) => {
    persistWorkspaceId(id);
    setWorkspaceIdState(id);
    // Trigger same-tab listeners (StorageEvent only fires cross-tab).
    window.dispatchEvent(
      new StorageEvent("storage", { key: "mos_workspace_id", newValue: id }),
    );
  }, []);

  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === workspaceId) ?? null;

  // Auto-select first workspace if none chosen.
  useEffect(() => {
    if (!workspaceId && workspaces && workspaces.length > 0) {
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaceId, workspaces, setWorkspaceId]);

  return { workspaceId, workspace, setWorkspaceId, workspaces: workspaces ?? [] };
}

export function useProducts(workspaceId: string) {
  return useQuery<Product[]>({
    queryKey: ["products", workspaceId],
    queryFn: () => api.products.list(workspaceId),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

export function useSelectedProduct(workspaceId: string) {
  const [productId, setProductIdState] = useState<string>("");

  useEffect(() => {
    setProductIdState(getProductId());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "mos_product_id") setProductIdState(e.newValue || "");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setProductId = useCallback((id: string) => {
    persistProductId(id);
    setProductIdState(id);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "mos_product_id", newValue: id }),
    );
  }, []);

  const { data: products } = useProducts(workspaceId);
  const product = products?.find((p) => p.id === productId) ?? null;

  useEffect(() => {
    if (workspaceId && !productId && products && products.length > 0) {
      setProductId(products[0].id);
    }
  }, [workspaceId, productId, products, setProductId]);

  return { productId, product, setProductId, products: products ?? [] };
}
