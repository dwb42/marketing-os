import {
  PlusCircle,
  Edit3,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  FileDiff,
  ArrowRight,
  Flag,
  Eye,
  Play,
} from "lucide-react";

/**
 * Maps a ChangeEvent.kind (e.g. "campaign.created", "campaign.transitioned",
 * "asset.version.added") to an icon + tone class pair.
 */
export function iconForEvent(kind: string): {
  icon: React.ElementType;
  tone: string;
} {
  const base = kind.toLowerCase();

  if (base.endsWith(".created") || base.endsWith(".proposed"))
    return { icon: PlusCircle, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  if (base.endsWith(".transitioned") || base.includes("transition"))
    return { icon: ArrowRight, tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" };
  if (base.includes("approval") || base.endsWith(".approved"))
    return { icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (base.includes("rejected") || base.includes("failed"))
    return { icon: AlertTriangle, tone: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (base.includes("sync") || base.includes("synced") || base.includes("push"))
    return { icon: RefreshCw, tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" };
  if (base.includes("pull") || base.includes("performance"))
    return { icon: RefreshCw, tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" };
  if (base.includes("version") || base.includes("asset"))
    return { icon: FileDiff, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  if (base.includes("updated") || base.includes("patched") || base.includes("edited"))
    return { icon: Edit3, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  if (base.includes("annotation") || base.includes("comment"))
    return { icon: MessageSquare, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300" };
  if (base.includes("finding"))
    return { icon: Flag, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400" };
  if (base.includes("review"))
    return { icon: Eye, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  if (base.includes("start") || base.includes("activate"))
    return { icon: Play, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };

  return { icon: ArrowRight, tone: "bg-muted text-muted-foreground" };
}
