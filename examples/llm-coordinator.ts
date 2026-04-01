/**
 * Example: LLM coordinator
 *
 * You describe the goal in plain English.
 * The LLM reads the bus manifest and decides which agents to invoke.
 * Execution is still deterministic — LLM only produces the plan.
 *
 * Run: ANTHROPIC_API_KEY=sk-... npx tsx examples/llm-coordinator.ts
 */
import { createBus, createAgent, createCoordinator } from '../src/index.js'

// ─── Specialist agents (pure handlers — no LLM inside) ────────────────────────

const summarizerAgent = createAgent<string, string>({
  name: 'summarizer',
  description: 'Summarizes long text into a single concise paragraph',
  commands: ['summarize'],
  handler: async task => {
    // In a real implementation this could call an LLM itself
    return `[Summary] ${task.input.slice(0, 120)}...`
  },
})

const translatorAgent = createAgent<{ text: string; lang: string }, string>({
  name: 'translator',
  description: 'Translates text into the requested language',
  commands: ['translate'],
  handler: async task => {
    return `[Translated to ${task.input.lang}] ${task.input.text}`
  },
})

const reviewerAgent = createAgent<string, { approved: boolean; reason: string }>({
  name: 'reviewer',
  description: 'Reviews text and returns approval status with a reason',
  commands: ['review'],
  handler: async task => {
    const approved = task.input.length > 20
    return {
      approved,
      reason: approved ? 'Content is substantial enough' : 'Content is too short',
    }
  },
})

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const bus = createBus()
  bus.register(summarizerAgent)
  bus.register(translatorAgent)
  bus.register(reviewerAgent)

  // Show the manifest the LLM will see
  console.log('\n📋 Bus manifest:')
  console.log(JSON.stringify(bus.manifest(), null, 2))

  const coordinator = createCoordinator(bus, {
    provider: 'anthropic',
    // apiKey: 'sk-...',   ← or set ANTHROPIC_API_KEY env var
    model: 'claude-sonnet-4-20250514',
  })

  const goal = 'Summarize the article, then review it for approval'
  console.log(`\n🎯 Goal: "${goal}"\n`)

  // Preview the plan before executing
  const plan = await coordinator.plan(goal)
  console.log('📐 Delegation plan:')
  console.log(JSON.stringify(plan, null, 2))

  // Execute
  console.log('\n⚙️  Executing...\n')
  const results = await coordinator.run(goal)

  console.log('── Results ──────────────────────────────────────')
  for (const r of results) {
    const icon = r.status === 'done' ? '✅' : '❌'
    console.log(`${icon} [${r.to}] → ${r.status}`)
    if (r.output !== undefined) console.log(`   Output:`, r.output)
    if (r.status === 'failed') console.log(`   Error: ${r.error?.message}`)
  }
}

main().catch(console.error)
