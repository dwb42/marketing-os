// Domain- und Service-Fehler. Nicht zu verwechseln mit ConnectorError
// (siehe src/connectors/types.ts) oder HTTP-Fehlern (Fastify-seitig gemappt).

export type ErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_INPUT"
  | "INVALID_STATE"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "INTERNAL";

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function notFound(entity: string, id: string): DomainError {
  return new DomainError("NOT_FOUND", `${entity} ${id} not found`, { entity, id });
}

export function invalidState(message: string, details?: Record<string, unknown>): DomainError {
  return new DomainError("INVALID_STATE", message, details);
}

export function invalidInput(message: string, details?: Record<string, unknown>): DomainError {
  return new DomainError("INVALID_INPUT", message, details);
}

export function forbidden(message: string, details?: Record<string, unknown>): DomainError {
  return new DomainError("FORBIDDEN", message, details);
}
