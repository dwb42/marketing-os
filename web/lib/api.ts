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
  Hypothesis,
  Experiment,
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
    structure: (id: string, workspaceId: string) =>
      request<import("./types").CampaignStructureChannel[]>(
        "GET",
        `/campaigns/${id}/structure`,
        { query: { workspaceId } },
      ),
    syncStructure: (
      id: string,
      body: { workspaceId: string; actorId?: string; from?: string; to?: string },
    ) =>
      request<{
        results: Array<{
          channelCampaignId: string;
          syncRunId: string;
          structure: {
            adGroupsTotal: number;
            adsTotal: number;
            keywordsTotal: number;
            negativesTotal: number;
            eventCount: number;
          };
          performance: { adGroupRows: number; keywordRows: number; adRows: number };
        }>;
      }>("POST", `/campaigns/${id}/structure/sync`, { body }),
    changelogTree: (
      id: string,
      params: { workspaceId: string; from?: string; to?: string },
    ) =>
      request<ChangeEvent[]>("GET", `/campaigns/${id}/changelog-tree`, {
        query: params,
      }),
  },

  channelAdGroups: {
    performance: (
      id: string,
      params: { workspaceId: string; from: string; to: string },
    ) =>
      request<PerformanceRow[]>("GET", `/channel-ad-groups/${id}/performance`, {
        query: params,
      }),
  },

  channelKeywords: {
    performance: (
      id: string,
      params: { workspaceId: string; from: string; to: string },
    ) =>
      request<PerformanceRow[]>("GET", `/channel-keywords/${id}/performance`, {
        query: params,
      }),
  },

  channelAds: {
    performance: (
      id: string,
      params: { workspaceId: string; from: string; to: string },
    ) =>
      request<PerformanceRow[]>("GET", `/channel-ads/${id}/performance`, {
        query: params,
      }),
  },

  initiatives: {
    list: (params: { workspaceId: string; status?: string }) =>
      request<Initiative[]>("GET", "/initiatives", { query: params }),
    get: (id: string, workspaceId: string) =>
      request<Initiative>("GET", `/initiatives/${id}`, { query: { workspaceId } }),
    timeline: (id: string, workspaceId: string) =>
      request<{
        initiative: Initiative;
        campaigns: Campaign[];
        hypotheses: Hypothesis[];
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
    validate: (id: string, workspaceId: string, body: { validation: string; actorId?: string }) =>
      request<{ ok: true }>("POST", `/clusters/${id}/validate`, {
        query: { workspaceId },
        body,
      }),
  },

  hypotheses: {
    list: (params: { workspaceId: string; initiativeId?: string }) =>
      request<Hypothesis[]>("GET", "/hypotheses", { query: params }),
  },

  experiments: {
    list: (params: {
      workspaceId: string;
      status?: string;
      hypothesisId?: string;
      initiativeId?: string;
    }) => request<Experiment[]>("GET", "/experiments", { query: params }),
    get: (id: string, workspaceId: string) =>
      request<Experiment>("GET", `/experiments/${id}`, { query: { workspaceId } }),
    start: (id: string, body: { workspaceId: string; actorId?: string }) =>
      request<{ ok: true }>("POST", `/experiments/${id}/start`, { body }),
    conclude: (
      id: string,
      body: { workspaceId: string; conclusion: string; actorId?: string },
    ) => request<{ ok: true }>("POST", `/experiments/${id}/conclude`, { body }),
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
    setStatus: (id: string, workspaceId: string, body: { status: string; actorId?: string }) =>
      request<{ ok: true }>("POST", `/findings/${id}/status`, {
        query: { workspaceId },
        body,
      }),
  },

  assets: {
    versions: (assetId: string, workspaceId: string) =>
      request<AssetVersion[]>("GET", `/assets/${assetId}/versions`, {
        query: { workspaceId },
      }),
    diff: (assetId: string, workspaceId: string, a: string, b: string) =>
      request<{
        a: { id: string; versionNum: number; status: string; contentHash: string };
        b: { id: string; versionNum: number; status: string; contentHash: string };
        diff: Record<string, { a: unknown; b: unknown; changed: boolean }>;
        identical: boolean;
      }>("GET", `/assets/${assetId}/diff`, { query: { workspaceId, a, b } }),
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
    list: (params: { workspaceId: string; initiativeId?: string; hypothesisId?: string }) =>
      request<Learning[]>("GET", "/learnings", { query: params }),
    create: (body: {
      workspaceId: string;
      statement: string;
      confidence?: "LOW" | "MEDIUM" | "HIGH";
      evidence?: Array<{
        type:
          | "PERFORMANCE_WINDOW"
          | "EXPERIMENT"
          | "OUTCOME_WINDOW"
          | "ANNOTATION"
          | "FINDING"
          | "OTHER";
        ref: string;
        note?: string;
      }>;
      initiativeId?: string;
      hypothesisId?: string;
      experimentId?: string;
      validUntil?: string;
      actorId?: string;
    }) => request<{ id: string }>("POST", "/learnings", { body }),
  },

  annotations: {
    listForSubject: (workspaceId: string, subjectType: string, subjectId: string) =>
      request<Annotation[]>("GET", "/annotations", {
        query: { workspaceId, subjectType, subjectId },
      }),
    listWorkspace: (params: {
      workspaceId: string;
      pinned?: boolean;
      subjectType?: string;
    }) =>
      request<Annotation[]>("GET", "/annotations", {
        query: {
          workspaceId: params.workspaceId,
          ...(params.pinned !== undefined ? { pinned: String(params.pinned) } : {}),
          ...(params.subjectType ? { subjectType: params.subjectType } : {}),
        },
      }),
    create: (body: {
      workspaceId: string;
      subjectType: string;
      subjectId: string;
      body: string;
      occurredAt: string;
      pinned?: boolean;
      actorId?: string;
    }) => request<{ id: string }>("POST", "/annotations", { body }),
  },

  approvals: {
    list: (params: {
      workspaceId: string;
      targetType?: string;
      targetId?: string;
      decision?: string;
    }) => request<Approval[]>("GET", "/approvals", { query: params }),
    record: (body: {
      workspaceId: string;
      targetType: string;
      targetId: string;
      decision: string;
      comment?: string;
      payload?: Record<string, unknown>;
      actorId?: string;
    }) => request<{ id: string }>("POST", "/approvals", { body }),
  },

  sync: {
    triggerCampaign: (campaignId: string, body: { workspaceId: string; actorId?: string }) =>
      request<{
        ok: true;
        syncRunId: string;
        channelCampaignId: string;
        externalIds: Record<string, string>;
      }>("POST", `/campaigns/${campaignId}/sync`, { body }),
  },

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
