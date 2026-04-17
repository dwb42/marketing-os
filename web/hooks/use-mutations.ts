"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getActorId } from "@/lib/config";

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
    onSuccess: () => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cluster"] });
      qc.invalidateQueries({ queryKey: ["clusters"] });
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
