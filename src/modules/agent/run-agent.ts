import type { User } from "@prisma/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import { getLLM } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { buildToolDefinitions, executeTool } from "./tools";

export interface RunAgentParams {
  tenant: ResolvedTenant;
  customer: User;
  /** Historial user/assistant en orden cronológico (incluye el mensaje actual). */
  history: ChatCompletionMessageParam[];
}

/** Bucle de function calling: llama a la IA, ejecuta herramientas y repite hasta obtener texto. */
export async function runAgent({ tenant, customer, history }: RunAgentParams): Promise<string> {
  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
    prisma.staffMember.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: "asc" } }),
  ]);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt({ tenant, services, staff, customer }) },
    ...history,
  ];
  const tools = buildToolDefinitions(tenant);
  const ctx = { tenant, customer };

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
    if (!reply.tool_calls?.length) return reply.content?.trim() || tenant.agent.fallbackMessage;

    messages.push({ role: "assistant", content: reply.content, tool_calls: reply.tool_calls });

    for (const call of reply.tool_calls) {
      const result =
        call.type === "function"
          ? await executeTool(call.function.name, call.function.arguments, ctx)
          : { error: "UNSUPPORTED_TOOL_TYPE" };
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return tenant.agent.fallbackMessage;
}
