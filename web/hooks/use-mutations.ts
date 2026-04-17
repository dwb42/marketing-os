"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getActorId } from "@/lib/config";
import type { Finding, IntentCluster } from "@/lib/types";

/**
 * Mutation hooks for all write actions in the admin UI.
 *
 * All hooks pull `actorId` from localStorage (set in Settings). Cache
 * invalidation is broad on purpose — write actions are rare, re-fetch cost
 * is low, and staleness bugs are high-impact.
 */

export function useCampaignTransition(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      to,
      reason,
    }: {
      campaignId: string;
      to: string;
      reason?: string;
    }) =>
      api.campaigns.transition(campaignId, workspaceId, {
        to,
        ...(getActorId() ? { actorId: getActorId() } : {}),
        ...(reason ? { reason } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["changelog"] });
    },
  });
}

export function useSyncCampaign(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId }: { campaignId: string }) =>
      api.sync.triggerCampaign(campaignId, {
        workspaceId,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["sync-runs"] });
      qc.invalidateQueries({ queryKey: ["changelog"] });
    },
  });
}

export function useRecordApproval(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      targetType: string;
      targetId: string;
      decision: string;
      comment?: string;
    }) =>
      api.approvals.record({
        workspaceId,
        ...body,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["changelog"] });
    },
  });
}

export function useFindingStatus(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, status }: { findingId: string; status: string }) =>
      api.findings.setStatus(findingId, workspaceId, {
        status,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onMutate: async ({ findingId, status }) => {
      // Snapshot every findings cache entry + patch the matching row.
      await qc.cancelQueries({ queryKey: ["findings-all"] });
      await qc.cancelQueries({ queryKey: ["findings"] });
      const snapshots: Array<[readonly unknown[], Finding[] | undefined]> = [];
      qc.getQueriesData<Finding[]>({ queryKey: ["findings-all"] }).forEach(
        ([key, data]) => {
          snapshots.push([key, data]);
          if (data) {
            qc.setQueryData<Finding[]>(
              key,
              data.map((f) =>
                f.id === findingId
                  ? { ...f, status: status as Finding["status"] }
                  : f,
              ),
            );
          }
        },
      );
      qc.getQueriesData<Finding[]>({ queryKey: ["findings"] }).forEach(
        ([key, data]) => {
          snapshots.push([key, data]);
          if (data) {
            qc.setQueryData<Finding[]>(
              key,
              data.map((f) =>
                f.id === findingId
                  ? { ...f, status: status as Finding["status"] }
                  : f,
              ),
            );
          }
        },
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["findings"] });
      qc.invalidateQueries({ queryKey: ["findings-all"] });
      qc.invalidateQueries({ queryKey: ["cluster"] });
    },
  });
}

export function useClusterValidate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clusterId, validation }: { clusterId: string; validation: string }) =>
      api.clusters.validate(clusterId, workspaceId, {
        validation,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onMutate: async ({ clusterId, validation }) => {
      await qc.cancelQueries({ queryKey: ["cluster", clusterId] });
      const prevDetail = qc.getQueryData<IntentCluster>(["cluster", clusterId, workspaceId]);
      if (prevDetail) {
        qc.setQueryData<IntentCluster>(
          ["cluster", clusterId, workspaceId],
          { ...prevDetail, validation: validation as IntentCluster["validation"] },
        );
      }
      const prevLists: Array<[readonly unknown[], IntentCluster[] | undefined]> = [];
      qc.getQueriesData<IntentCluster[]>({ queryKey: ["clusters"] }).forEach(
        ([key, data]) => {
          prevLists.push([key, data]);
          if (data) {
            qc.setQueryData<IntentCluster[]>(
              key,
              data.map((c) =>
                c.id === clusterId
                  ? { ...c, validation: validation as IntentCluster["validation"] }
                  : c,
              ),
            );
          }
        },
      );
      return { prevDetail, prevLists };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prevDetail) {
        qc.setQueryData(["cluster", vars.clusterId, workspaceId], ctx.prevDetail);
      }
      ctx?.prevLists.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cluster"] });
      qc.invalidateQueries({ queryKey: ["clusters"] });
      qc.invalidateQueries({ queryKey: ["changelog"] });
    },
  });
}

export function useExperimentStart(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experimentId }: { experimentId: string }) =>
      api.experiments.start(experimentId, {
        workspaceId,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiments"] });
      qc.invalidateQueries({ queryKey: ["initiative-timeline"] });
      qc.invalidateQueries({ queryKey: ["changelog"] });
    },
  });
}

export function useExperimentConclude(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      experimentId,
      conclusion,
    }: {
      experimentId: string;
      conclusion: string;
    }) =>
      api.experiments.conclude(experimentId, {
        workspaceId,
        conclusion,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiments"] });
      qc.invalidateQueries({ queryKey: ["initiative-timeline"] });
      qc.invalidateQueries({ queryKey: ["changelog"] });
    },
  });
}

export function useCreateLearning(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
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
    }) =>
      api.learnings.create({
        workspaceId,
        ...body,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learnings"] });
      qc.invalidateQueries({ queryKey: ["initiative-timeline"] });
      qc.invalidateQueries({ queryKey: ["changelog"] });
    },
  });
}

export function useCreateAnnotation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      subjectType: string;
      subjectId: string;
      body: string;
      occurredAt: string;
      pinned?: boolean;
    }) =>
      api.annotations.create({
        workspaceId,
        ...body,
        ...(getActorId() ? { actorId: getActorId() } : {}),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["annotations", vars.subjectType, vars.subjectId, workspaceId],
      });
      qc.invalidateQueries({ queryKey: ["initiative-timeline"] });
    },
  });
}
