import type { User } from "@prisma/client";
import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { ResolvedTenant } from "@/lib/tenant";

/** Contexto inyectado a cada herramienta: nunca confíes en IDs de tenant/cliente que envíe la IA. */
export interface ToolContext {
  tenant: ResolvedTenant;
  customer: User;
}

export type ToolResult = Record<string, unknown>;

export interface AgentTool<Args> {
  name: string;
  /** La definición se construye por tenant para usar su terminología en las descripciones. */
  definition: (tenant: ResolvedTenant) => ChatCompletionFunctionTool;
  handler: (args: Args, ctx: ToolContext) => Promise<ToolResult>;
}
