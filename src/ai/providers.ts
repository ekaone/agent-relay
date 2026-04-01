import type {
  AgentManifestEntry,
  CoordinatorConfig,
  DelegationPlan,
} from "../types.js";

const PLAN_SYSTEM = `You are a task coordinator. Your job is to read a goal and decide which agents to invoke and in what order.

You will be given a list of available agents with their names, descriptions, and commands.
Return ONLY a JSON object — no explanation, no markdown, no preamble.

Schema:
{
  "steps": [
    { "to": "<agent name>", "input": { "command": "<command>", "args": {} } }
  ]
}

Rules:
- Only use agents from the provided manifest.
- Keep steps minimal — only what is needed to fulfil the goal.
- If a goal cannot be fulfilled by the available agents, return { "steps": [] }.`;

function buildUserMessage(
  goal: string,
  manifest: AgentManifestEntry[],
): string {
  return `Available agents:\n${JSON.stringify(manifest, null, 2)}\n\nGoal: ${goal}`;
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function resolveWithAnthropic(
  goal: string,
  manifest: AgentManifestEntry[],
  config: CoordinatorConfig,
): Promise<DelegationPlan> {
  const apiKey = config.apiKey ?? process.env["ANTHROPIC_API_KEY"];
  if (!apiKey)
    throw new Error(
      "Anthropic API key is required. Set ANTHROPIC_API_KEY or pass apiKey.",
    );

  const model = config.model ?? "claude-sonnet-4-6";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: PLAN_SYSTEM,
      messages: [{ role: "user", content: buildUserMessage(goal, manifest) }],
    }),
  });

  if (!res.ok)
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((b) => b.type === "text")?.text ?? "";
  return parsePlan(text);
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function resolveWithOpenAI(
  goal: string,
  manifest: AgentManifestEntry[],
  config: CoordinatorConfig,
): Promise<DelegationPlan> {
  const apiKey = config.apiKey ?? process.env["OPENAI_API_KEY"];
  if (!apiKey)
    throw new Error(
      "OpenAI API key is required. Set OPENAI_API_KEY or pass apiKey.",
    );

  const model = config.model ?? "gpt-4o";
  const baseURL = config.baseURL ?? "https://api.openai.com/v1";

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: buildUserMessage(goal, manifest) },
      ],
    }),
  });

  if (!res.ok)
    throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices[0]?.message?.content ?? "";
  return parsePlan(text);
}

// ─── Ollama ───────────────────────────────────────────────────────────────────

async function resolveWithOllama(
  goal: string,
  manifest: AgentManifestEntry[],
  config: CoordinatorConfig,
): Promise<DelegationPlan> {
  const baseURL = config.baseURL ?? "http://localhost:11434";
  const model = config.model ?? "llama3";

  const res = await fetch(`${baseURL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: buildUserMessage(goal, manifest) },
      ],
    }),
  });

  if (!res.ok)
    throw new Error(`Ollama API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { message: { content: string } };
  return parsePlan(data.message?.content ?? "");
}

// ─── Plan parser ─────────────────────────────────────────────────────────────

function parsePlan(raw: string): DelegationPlan {
  const clean = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean) as DelegationPlan;
    if (!Array.isArray(parsed.steps))
      throw new Error("Invalid plan: missing steps array");
    return parsed;
  } catch {
    throw new Error(
      `Could not parse delegation plan from LLM response:\n${raw}`,
    );
  }
}

// ─── Public resolver ──────────────────────────────────────────────────────────

export async function resolvePlan(
  goal: string,
  manifest: AgentManifestEntry[],
  config: CoordinatorConfig,
): Promise<DelegationPlan> {
  // Custom resolver — user brings their own
  if (config.resolvePlan) {
    return config.resolvePlan(goal, manifest);
  }

  const provider = config.provider ?? "anthropic";

  switch (provider) {
    case "anthropic":
      return resolveWithAnthropic(goal, manifest, config);
    case "openai":
      return resolveWithOpenAI(goal, manifest, config);
    case "ollama":
      return resolveWithOllama(goal, manifest, config);
    case "custom":
      throw new Error(
        'Provider "custom" requires a resolvePlan function in CoordinatorConfig',
      );
    default:
      throw new Error(`Unknown provider: ${String(provider)}`);
  }
}
