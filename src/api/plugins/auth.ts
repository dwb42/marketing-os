import type { FastifyInstance, FastifyRequest } from "fastify";
import { DomainError } from "../../lib/errors.js";
import type { ActorRole } from "../../domain/status.js";

// Service-Token-basierte Auth für MVP. Ein Token bindet sich an
// (workspaceId, actorId, actorRole). In Phase 4 ersetzt durch signierte JWTs.
//
// Konfiguration via Env:
//   MOS_TOKENS='[{"token":"dev-strategist","workspaceId":"wsp_pflegemax_team","actorId":"act_strategist","role":"strategist"}, ...]'
//
// Fehlt MOS_TOKENS, läuft der Server in "open-dev"-Modus: Jeder Request
// bekommt einen System-Actor und arbeitet auf dem Workspace, der im
// Query- oder Body-Parameter steht. Bewusst komfortabel für lokale Arbeit.

export interface AuthContext {
  workspaceId: string;
  actorId: string;
  role: ActorRole;
  openDev: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

interface TokenEntry {
  token: string;
  workspaceId: string;
  actorId: string;
  role: ActorRole;
}

function loadTokens(): Map<string, TokenEntry> {
  const raw = process.env.MOS_TOKENS;
  if (!raw) return new Map();
  try {
    const arr = JSON.parse(raw) as TokenEntry[];
    return new Map(arr.map((e) => [e.token, e]));
  } catch {
    throw new Error("MOS_TOKENS is set but could not be parsed as JSON");
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  const tokens = loadTokens();
  const openDev = tokens.size === 0;

  app.decorateRequest("auth", null as unknown as AuthContext);

  app.addHook("onRequest", async (req: FastifyRequest) => {
    if (req.url === "/health") {
      req.auth = {
        workspaceId: "wsp_system",
        actorId: "act_system",
        role: "operator",
        openDev: true,
      };
      return;
    }

    if (openDev) {
      // In open-dev: wir brauchen einen workspaceId-Hinweis. Der kommt aus
      // Query (?workspaceId=...) oder Body ({workspaceId: ...}). Liegt keiner
      // vor, setzen wir Platzhalter — Services prüfen selbst auf Existenz.
      const q = req.query as { workspaceId?: string } | undefined;
      const b = req.body as { workspaceId?: string } | undefined;
      const workspaceId = q?.workspaceId ?? b?.workspaceId ?? "wsp_open_dev";
      req.auth = {
        workspaceId,
        actorId: "act_open_dev",
        role: "operator",
        openDev: true,
      };
      return;
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new DomainError("UNAUTHENTICATED", "Missing bearer token");
    }
    const token = header.slice("Bearer ".length).trim();
    const entry = tokens.get(token);
    if (!entry) {
      throw new DomainError("UNAUTHENTICATED", "Invalid token");
    }
    req.auth = {
      workspaceId: entry.workspaceId,
      actorId: entry.actorId,
      role: entry.role,
      openDev: false,
    };
  });
}
