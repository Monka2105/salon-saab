import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { ResolvedTenant } from "@/lib/tenant";
import { bookAppointment } from "./book-appointment";
import { cancelAppointment } from "./cancel-appointment";
import { checkAvailability } from "./check-availability";
import { getAvailableServices } from "./get-available-services";
import { getMyAppointments } from "./get-my-appointments";
import { prepareBooking } from "./prepare-booking";
import type { AgentTool, ToolContext, ToolResult } from "./types";

// Registro de herramientas: para añadir una nueva, crea su archivo y agrégala aquí.
const TOOLS: AgentTool<any>[] = [
  getAvailableServices,
  checkAvailability,
  prepareBooking,
  bookAppointment,
  getMyAppointments,
  cancelAppointment,
];

const registry = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function buildToolDefinitions(tenant: ResolvedTenant): ChatCompletionFunctionTool[] {
  return TOOLS.map((tool) => tool.definition(tenant));
}

export async function executeTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) return { error: `UNKNOWN_TOOL: ${name}` };

  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: "INVALID_JSON_ARGUMENTS" };
  }

  try {
    return await tool.handler(args, ctx);
  } catch (err) {
    console.error(`[agent] tool ${name} failed`, err);
    return { error: err instanceof Error ? err.message : "TOOL_ERROR" };
  }
}
