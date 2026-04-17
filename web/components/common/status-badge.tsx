import { Badge } from "@/components/ui/badge";
import type {
  CampaignStatus,
  SyncRunStatus,
  ClusterValidation,
  FindingStatus,
  FindingConfidence,
  InitiativeStatus,
  AssetVersionStatus,
} from "@/lib/types";

type AnyStatus =
  | CampaignStatus
  | SyncRunStatus
  | ClusterValidation
  | FindingStatus
  | FindingConfidence
  | InitiativeStatus
  | AssetVersionStatus
  | string;

function variantFor(status: AnyStatus): Parameters<typeof Badge>[0]["variant"] {
  switch (status) {
    // Campaign / asset lifecycle
    case "DRAFT":
      return "muted";
    case "IN_REVIEW":
      return "warning";
    case "APPROVED":
      return "info";
    case "SYNCED":
    case "PUBLISHED":
    case "SUCCEEDED":
    case "EVIDENCED":
    case "ACTIVE":
    case "DONE":
      return "success";
    case "PAUSED":
    case "ON_HOLD":
      return "warning";
    case "ARCHIVED":
    case "SUPERSEDED":
    case "CANCELLED":
      return "muted";
    case "FAILED":
    case "REFUTED":
      return "danger";
    case "PARTIAL":
      return "warning";
    case "RUNNING":
    case "PENDING":
      return "info";
    case "WEAK_EVIDENCE":
    case "HYPOTHESIS":
    case "PROPOSED":
      return "outline";

    // Findings
    case "OPEN":
      return "warning";
    case "ADDRESSED":
      return "success";
    case "WONT_FIX":
      return "muted";

    // Confidence
    case "HIGH":
      return "success";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "muted";

    default:
      return "default";
  }
}

export function StatusBadge({
  status,
  className,
}: {
  status: AnyStatus;
  className?: string;
}) {
  return (
    <Badge variant={variantFor(status)} className={className}>
      {String(status).replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}
