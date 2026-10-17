import type { User } from "@prisma/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import { getLLM } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { textReply, uiFromToolResult, type AgentReply } from "./reply";
import { buildToolDefinitions, executeTool } from "./tools";

export interface RunAgentParams {
  tenant: ResolvedTenant;
  customer: User;
  /** Historial user/assistant en orden cronológico (incluye el mensaje actual). */
  history: ChatCompletionMessageParam[];
  /** Sin mensajes recientes: la IA saluda; si no, va directo al grano. */
  newConversation: boolean;
}

/**
 * Bucle de function calling: llama a la IA, ejecuta herramientas y repite hasta obtener texto.
 * Las herramientas de catálogo, horarios y confirmación dejan una interfaz (lista o botones)
 * que acompaña al texto final de la IA.
 */
export async function runAgent({ tenant, customer, history, newConversation }: RunAgentParams): Promise<AgentReply> {
  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
    prisma.staffMember.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: "asc" } }),
  ]);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt({ tenant, services, staff, customer, newConversation }) },
    ...history,
  ];
  const tools = buildToolDefinitions(tenant);
  const ctx = { tenant, customer };
  let ui: ((body: string) => AgentReply | null) | null = null;

  for (let round = 0; round < tenant.agent.maxToolRounds; round++) {
    const completion = await getLLM().chat.completions.create({
      model: tenant.agent.model,
      temperature: tenant.agent.temperature,
      messages,
      tools,
      tool_choice: "auto",
    });

    const reply = completion.choices[0]?.message;
    if (!reply) break;
    if (!reply.tool_calls?.length) {
      const text = reply.content?.trim() ?? "";
      return ui?.(text || "Estas son las opciones:") ?? textReply(text || tenant.agent.fallbackMessage);
    }

    messages.push({ role: "assistant", content: reply.content, tool_calls: reply.tool_calls });

    for (const call of reply.tool_calls) {
      const result =
        call.type === "function"
          ? await executeTool(call.function.name, call.function.arguments, ctx)
          : { error: "UNSUPPORTED_TOOL_TYPE" };
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });

      if (call.type === "function") {
        const next = uiFromToolResult(call.function.name, result, tenant);
        if (next !== undefined) ui = next;
      }
    }
  }

  return textReply(tenant.agent.fallbackMessage);
}
