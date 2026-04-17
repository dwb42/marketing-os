import { getApiBase, getToken } from "./config";
import type {
  Workspace,
  Product,
  Campaign,
  Initiative,
  IntentCluster,
  Finding,
  SyncRun,
  ChangeEvent,
  Annotation,
  PerformanceRow,
  OutcomeEvent,
  FunnelResponse,
  Learning,
  SearchResponse,
  Asset,
  AssetVersion,
  Approval,
} from "./types";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const base = getApiBase().replace(/\/$/, "");
  const url = new URL(base + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "HTTP_ERROR",
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }
  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Tenancy
// ─────────────────────────────────────────────────────────────

export const api = {
  health: () => request<{ ok: boolean }>("GET", "/health"),

  workspaces: {
    list: () => request<Workspace[]>("GET", "/workspaces"),
  },

  products: {
    list: (workspaceId: string) =>
      request<Product[]>("GET", "/products", { query: { workspaceId } }),
  },

  campaigns: {
    list: (params: { workspaceId: string; productId?: string; status?: string }) =>
      request<Campaign[]>("GET", "/campaigns", { query: params }),
    get: (id: string, workspaceId: string) =>
      request<Campaign>("GET", `/campaigns/${id}`, { query: { workspaceId } }),
    transition: (
      id: string,
      workspaceId: string,
      body: { to: string; actorId?: string; reason?: string },
    ) =>
      request<{ ok: true }>("POST", `/campaigns/${id}/transition`, {
        query: { workspaceId },
        body,
      }),
  },

  initiatives: {
    // No backend list endpoint yet — derive via /search in caller if needed.
    timeline: (id: string, workspaceId: string) =>
      request<{
        initiative: Initiative;
        campaigns: Campaign[];
        hypotheses: unknown[];
        learnings: Learning[];
        events: ChangeEvent[];
        annotations: Annotation[];
        performance: PerformanceRow[];
      }>("GET", `/initiatives/${id}/timeline`, { query: { workspaceId } }),
  },

  clusters: {
    list: (params: {
      workspaceId: string;
      productId?: string;
      status?: string;
      validation?: string;
      initiativeId?: string;
    }) => request<IntentCluster[]>("GET", "/clusters", { query: params }),
    get: (id: string, workspaceId: string) =>
      request<IntentCluster>("GET", `/clusters/${id}`, { query: { workspaceId } }),
  },

  findings: {
    list: (params: {
      workspaceId: string;
      initiativeId?: string;
      clusterId?: string;
      status?: string;
    }) => request<Finding[]>("GET", "/findings", { query: params }),
    get: (id: string, workspaceId: string) =>
      request<Finding>("GET", `/findings/${id}`, { query: { workspaceId } }),
  },

  assets: {
    versions: (assetId: string, workspaceId: string) =>
      request<AssetVersion[]>("GET", `/assets/${assetId}/versions`, {
        query: { workspaceId },
      }),
  },

  performance: {
    query: (params: { channelCampaignId: string; from: string; to: string }) =>
      request<PerformanceRow[]>("GET", "/performance", { query: params }),
  },

  outcomes: {
    query: (params: { productId: string; type?: string; from: string; to: string }) =>
      request<OutcomeEvent[]>("GET", "/outcomes", { query: params }),
    funnel: (params: { productId: string; from: string; to: string }) =>
      request<FunnelResponse>("GET", "/outcomes/funnel", { query: params }),
  },

  changelog: {
    query: (params: {
      workspaceId: string;
      subjectType?: string;
      subjectId?: string;
      from?: string;
      to?: string;
    }) => request<ChangeEvent[]>("GET", "/changelog", { query: params }),
  },

  syncRuns: {
    list: (params: { workspaceId: string; status?: string; channel?: string }) =>
      request<SyncRun[]>("GET", "/sync-runs", { query: params }),
    get: (id: string, workspaceId: string) =>
      request<SyncRun>("GET", `/sync-runs/${id}`, { query: { workspaceId } }),
  },

  learnings: {
    list: (params: { workspaceId: string; initiativeId?: string }) =>
      request<Learning[]>("GET", "/learnings", { query: params }),
  },

  annotations: {
    // Backend only supports listing by subject (both subjectType + subjectId required).
    listForSubject: (workspaceId: string, subjectType: string, subjectId: string) =>
      request<Annotation[]>("GET", "/annotations", {
        query: { workspaceId, subjectType, subjectId },
      }),
  },

  // /approvals has no list endpoint yet — intentionally omitted.

  search: (params: {
    workspaceId: string;
    q?: string;
    initiativeId?: string;
    clusterId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) => request<SearchResponse>("GET", "/search", { query: params }),
};

export type { Approval };

export type Api = typeof api;
