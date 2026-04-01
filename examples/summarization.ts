/**
 * Example: Text Summarization Pipeline
 *
 * Demonstrates a multi-agent pipeline for processing long articles:
 * 1. Extract key points
 * 2. Generate summary
 * 3. Validate quality
 *
 * Run: npx tsx examples/summarization.ts
 */
import { createBus, createAgent, delegate } from "../src/index.js";
import type { AgentTask } from "../src/index.js";
import Anthropic from "@anthropic-ai/sdk";

// ─── Shared LLM Client ────────────────────────────────────────────────────────

const llm = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

async function callClaude(prompt: string, maxTokens = 1000): Promise<string> {
  const response = await llm.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

/**
 * Extractor Agent
 * Uses AI to extract key points from text
 */
const extractorAgent = createAgent<string, string[]>({
  name: "extractor",
  description: "Uses AI to extract key points from text",
  commands: ["extract"],
  handler: async (task) => {
    const prompt = `Extract the 5 most important key points from the following text. 
Return ONLY a JSON array of strings, no other text.

Text:
${task.input}`;

    const response = await callClaude(prompt, 500);
    try {
      const match = response.match(/\[[\s\S]*\]/);
      const jsonStr = match ? match[0] : response;
      return JSON.parse(jsonStr) as string[];
    } catch {
      return response
        .split("\n")
        .filter((line) => line.trim().startsWith("-"))
        .map((line) => line.replace(/^- /, ""));
    }
  },
});

/**
 * Summarizer Agent
 * Uses AI to create a concise summary
 */
const summarizerAgent = createAgent<string[], string>({
  name: "summarizer",
  description: "Uses AI to create a concise summary",
  commands: ["summarize"],
  handler: async (task) => {
    const points = task.input.join("\n");
    const prompt = `Create a concise 2-3 sentence summary from these key points:

${points}

Summary:`;

    return await callClaude(prompt, 300);
  },
});

/**
 * Validator Agent
 * Uses AI to validate summary quality
 */
const validatorAgent = createAgent<
  string,
  { valid: boolean; score: number; feedback: string }
>({
  name: "validator",
  description: "Uses AI to validate summary quality",
  commands: ["validate"],
  handler: async (task) => {
    const prompt = `Evaluate this summary for quality and completeness.

Summary to evaluate:
${task.input}

Provide your evaluation in this exact JSON format:
{
  "valid": true/false,
  "score": 0-100,
  "feedback": "brief explanation"
}

Response:`;

    const response = await callClaude(prompt, 500);
    try {
      const match = response.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : response;
      return JSON.parse(jsonStr) as {
        valid: boolean;
        score: number;
        feedback: string;
      };
    } catch {
      return {
        valid: true,
        score: 70,
        feedback: "Summary generated (parsing fallback)",
      };
    }
  },
});

// ─── Sample Article ───

const sampleArticle = `
Coding agents generate code at unprecedented speeds. In the hands of disciplined engineers, 
they are a productivity multiplier. But without rigorous judgment, they are a highly efficient 
way to ship bad assumptions directly to production.

When teams deploy agent-generated code blindly, the fallout can be immediate and severe. 
A flawless-looking pull request can ship a query that passes tests, but scans every row in production. 
Retry logic that seems correct can cause a thundering herd on a downstream service. 
And a cache with no TTL can quietly grow until Redis dies.

Green CI is no longer proof of safety. In an agentic world, passing CI is merely a reflection 
of the agent's ability to persuade your pipeline that a change is safe, even if it will immediately 
degrade your infrastructure at scale.

Agent-generated code is dangerously convincing. It comes with a polished PR description, passes static analysis, 
follows repository conventions, and includes reasonable test coverage. On the surface, it looks like it was written 
by an experienced engineer.

But an agent doesn't understand your production environment. It doesn't know your traffic patterns, your failure modes, 
or the implicit constraints of your shared infrastructure. It doesn't know that a Redis instance is near capacity, 
that a database is hardcoded to a specific region, or that a feature flag rollout will fundamentally change the load profile 
of a downstream system.

The gap between "this PR looks correct" and "this PR is safe to ship" has always existed. Agents widen that gap by producing 
code that looks more flawless than ever, while remaining entirely blind to production realities.

- Guarding production
The answer isn't to stop using agents. The productivity gains are undeniable and models will only get better. 
AI-assisted code review and analysis are incredibly powerful tools that catch bugs and surface risks humans miss.
But relying solely on review, whether human or synthetic, is a losing battle against the sheer 
volume of agent-generated code. We've hit an inflection point where implementation is abundant. 
The scarce resource is no longer writing code, it's the judgment of what is safe to ship. All infrastructure must match that new reality.

This isn't about wrapping the development lifecycle in red tape. 
It's about building a closed-loop system where agents can act with high autonomy because their environment is standardized, verification is easy, and deployment is safe by default.

The organizing principle is simple: make the right thing easy to do.
Self-driving deployments. Every change rolls out incrementally through gated pipelines. 
If a canary deployment degrades, the rollout stops and rolls back automatically. The system doesn't rely on an engineer babysitting a dashboard. It catches the problem, contains it to a fraction of traffic, and reverses it. When something goes wrong, it goes wrong in isolation, not globally.

Continuous validation. The infrastructure tests itself continuously, not just at deploy. Load tests, chaos experiments, and disaster recovery exercises run on an ongoing basis. At Vercel, the database failover we rehearsed in production last summer is the reason a real Azure outage this year was a non-event for our customers. 
The systems that hold up under pressure are the ones that have been deliberately stressed.
Executable guardrails. At Vercel, we are encoding operational knowledge as runnable tools instead of documentation. 
A safe-rollout skill isn't a Notion page explaining how feature flags work. It's a tool that wires the flag, 
generates a rollout plan with rollback conditions, and specifies how to verify expected behavior. 
When guardrails are executable, agents follow them autonomously and humans don't have to memorize them.
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const bus = createBus();
  bus.register(extractorAgent);
  bus.register(summarizerAgent);
  bus.register(validatorAgent);

  console.log("📄 Article length:", sampleArticle.length, "characters");
  console.log("🤖 Using model:", MODEL, "\n");

  const results: AgentTask[] = [];

  // Step 1: Extract key points with AI
  console.log("⏳ Step 1: Extracting key points...");
  const extractResult = await delegate(bus, {
    from: "coordinator",
    to: "extractor",
    input: sampleArticle,
  });
  results.push(extractResult);

  // Step 2: Generate AI summary
  console.log("⏳ Step 2: Generating summary...");
  const summaryResult = await delegate(bus, {
    from: "coordinator",
    to: "summarizer",
    input: extractResult.output as string[],
  });
  results.push(summaryResult);

  // Step 3: Validate with AI
  console.log("⏳ Step 3: Validating quality...\n");
  const validateResult = await delegate(bus, {
    from: "coordinator",
    to: "validator",
    input: summaryResult.output as string,
  });
  results.push(validateResult);

  console.log("── Pipeline Results ──");

  // Display results
  console.log(`\n1️⃣  [${extractResult.to}] → ${extractResult.status}`);
  if (extractResult.status === "done") {
    const points = extractResult.output as string[];
    console.log(`   Extracted ${points.length} key points:`);
    points.forEach((p, i) => console.log(`   ${i + 1}. ${p.slice(0, 80)}...`));
  }

  console.log(`\n2️⃣  [${summaryResult.to}] → ${summaryResult.status}`);
  if (summaryResult.status === "done") {
    console.log("   📝 Summary:");
    console.log(
      "   ",
      (summaryResult.output as string).split("\n").join("\n    "),
    );
  }

  console.log(`\n3️⃣  [${validateResult.to}] → ${validateResult.status}`);
  if (validateResult.status === "done") {
    const validation = validateResult.output as {
      valid: boolean;
      score: number;
      feedback: string;
    };
    const icon = validation.valid ? "✅" : "⚠️";
    console.log(`   ${icon} Score: ${validation.score}/100`);
    console.log(`   Feedback: ${validation.feedback}`);
  }

  // Show any failures
  const failures = results.filter((r) => r.status === "failed");
  if (failures.length > 0) {
    console.log("\n── Failures ──");
    failures.forEach((f) => console.log(`❌ [${f.to}]: ${f.error?.message}`));
  }

  // Display task history
  const history = await bus.history();
  console.log("\n── Task History ──");
  console.log(`Total tasks: ${history.length}`);

  for (const task of history) {
    console.log(`\n[${task.id}] ${task.from} → ${task.to}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Created: ${new Date(task.createdAt).toLocaleTimeString()}`);
    if (task.output)
      console.log(`  Output:`, JSON.stringify(task.output).slice(0, 100));
    if (task.error) console.log(`  Error:`, task.error.message);
  }
}

main().catch(console.error);
