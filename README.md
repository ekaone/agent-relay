# @ekaone/agent-relay

## ⚠️Under active developement, use with caution

Framework-agnostic multi-agent task delegation.

- **In-memory message bus** — register named specialist agents, dispatch typed tasks
- **Deterministic coordinator** — you write the step sequence in code
- **LLM coordinator** — describe a goal in plain English, the LLM plans, execution stays deterministic
- **AI provider support** — Anthropic (default), OpenAI, Ollama, or bring your own
- **Pluggable persistence** — swap the in-memory store for any backend via `BusStore` interface
- **Dead-letter queue** — failed tasks are captured and retryable
- **Zero runtime dependencies** — pure TypeScript, Node ≥ 18

---

## Install

```bash
npm install @ekaone/agent-relay
```

```bash
pnpm add @ekaone/agent-relay
```

```bash
yarn add @ekaone/agent-relay
```

---

## Quick Start

### Deterministic coordinator (no LLM)

```ts
import { createBus, createAgent, runDeterministic } from '@ekaone/agent-relay'

const bus = createBus()

const npmAgent = createAgent({
  name: 'npm',
  description: 'Runs npm lifecycle commands',
  commands: ['install', 'build', 'test'],
  handler: async task => {
    const { command } = task.input as { command: string }
    // run your shell command here
    return { success: true, command }
  },
})

const deployAgent = createAgent({
  name: 'deploy',
  description: 'Runs deployment commands',
  commands: ['docker-build', 'restart'],
  handler: async task => {
    const { command } = task.input as { command: string }
    return { success: true, command }
  },
})

bus.register(npmAgent)
bus.register(deployAgent)

const results = await runDeterministic(bus, [
  { to: 'npm',    input: { command: 'install' } },
  { to: 'npm',    input: { command: 'build' } },
  { to: 'npm',    input: { command: 'test' } },
  { to: 'deploy', input: { command: 'restart' } },
])
```

### LLM coordinator

```ts
import { createBus, createAgent, createCoordinator } from '@ekaone/agent-relay'

const bus = createBus()
bus.register(summarizerAgent)
bus.register(reviewerAgent)

const coordinator = createCoordinator(bus, {
  provider: 'anthropic',           // or 'openai' | 'ollama' | 'custom'
  // apiKey: 'sk-...'              // or set ANTHROPIC_API_KEY env var
  model: 'claude-sonnet-4-20250514',
})

// Preview the plan
const plan = await coordinator.plan('summarize and review the article')
console.log(plan.steps)

// Execute
const results = await coordinator.run('summarize and review the article')
```

---

## API

### `createBus(options?)`

Creates the central message bus.

```ts
const bus = createBus({
  store: myCustomStore,     // BusStore — defaults to in-memory
  defaultTimeoutMs: 30_000, // per-agent timeout default
})
```

| Method | Description |
|---|---|
| `bus.register(agent)` | Register a specialist agent |
| `bus.manifest()` | List all registered agents + capabilities |
| `bus.history()` | All tasks that flowed through the bus |
| `bus.dispatch(task)` | Low-level — dispatch a pre-built task |
| `bus.deadLetter.drain()` | Pull all failed tasks out of the DLQ |
| `bus.deadLetter.retry(id, bus)` | Re-dispatch a failed task by ID |

---

### `createAgent(definition)`

Defines a specialist agent.

```ts
const agent = createAgent<TInput, TOutput>({
  name: 'summarizer',
  description: 'Summarizes long text',   // shown to the LLM coordinator
  commands: ['summarize'],               // optional — helps LLM choose inputs
  timeoutMs: 10_000,                     // overrides bus default
  handler: async task => {
    return doWork(task.input)
  },
})
```

---

### `delegate(bus, options)`

Core dispatch primitive. Sends a task and awaits the result.

```ts
const result = await delegate<string, string>(bus, {
  from: 'coordinator',
  to: 'summarizer',
  input: 'Long text here...',
})

if (result.status === 'done') console.log(result.output)
if (result.status === 'failed') console.error(result.error)
```

---

### `send(bus, options)` / `receive(bus, agentName)`

Low-level fire-and-forget / FIFO polling.

```ts
// Enqueue without executing
const taskId = await send(bus, { from: 'coordinator', to: 'worker', input: 'job' })

// Poll the oldest pending task
const task = await receive(bus, 'worker')
```

---

### `runDeterministic(bus, steps, options?)`

Execute a fixed sequence of delegation steps.

```ts
const results = await runDeterministic(bus, [
  { to: 'npm',    input: { command: 'build' } },
  { to: 'deploy', input: { command: 'restart' } },
], {
  continueOnError: false,  // default — stop on first failure
})
```

---

### `createCoordinator(bus, config)`

LLM-powered coordinator. Reads `bus.manifest()` and produces a delegation plan.

```ts
const coordinator = createCoordinator(bus, {
  provider: 'anthropic',          // 'anthropic' | 'openai' | 'ollama' | 'custom'
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
  maxSteps: 20,
  continueOnError: false,
  // Bring your own planner:
  resolvePlan: async (goal, manifest) => ({ steps: [...] }),
})

const plan    = await coordinator.plan('build and ship 1.2.0')
const results = await coordinator.run('build and ship 1.2.0')
```

---

### AI Providers

| Provider | `provider` value | Key env var | Default model |
|---|---|---|---|
| Anthropic | `'anthropic'` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| OpenAI | `'openai'` | `OPENAI_API_KEY` | `gpt-4o` |
| Ollama | `'ollama'` | — | `llama3` |
| Custom | `'custom'` | — | provide `resolvePlan` |

---

### Pluggable Store (`BusStore`)

Swap the default in-memory store for any backend.

```ts
import type { BusStore, AgentTask } from '@ekaone/agent-relay'

const myStore: BusStore = {
  async save(task)        { /* write to DB */ },
  async find(id)          { /* read from DB */ return null },
  async list(filter)      { /* query DB */ return [] },
  async clear()           { /* delete all */ },
}

const bus = createBus({ store: myStore })
```

SQLite adapter: `@ekaone/agent-relay-sqlite` _(coming in v0.2.0)_

---

### Task Schema

```ts
interface AgentTask<TInput, TOutput> {
  id: string
  from: string
  to: string
  input: TInput
  output?: TOutput
  status: 'pending' | 'running' | 'done' | 'failed'
  error?: Error
  createdAt: number
  updatedAt: number
}
```

---

## Examples

See the [`examples/`](./examples/) directory for runnable code:

```bash
# Deterministic pipeline (no LLM)
npx tsx examples/deterministic.ts

# LLM coordinator (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-... npx tsx examples/llm-coordinator.ts

# Custom persistent store
npx tsx examples/custom-store.ts
```

---

## Roadmap

- `v0.1.0` — core bus, agents, delegate, deterministic + LLM coordinator, DLQ, pluggable store
- `v0.2.0` — `@ekaone/agent-relay-sqlite`, streaming task output, `delegateAll()` parallel dispatch, `bus.watch()`
- `v0.3.0` — agent checkpointing and replay — save the full agent context at any step and replay from that point for debugging or resuming failed executions

---

## License

MIT © [Eka Prasetia](https://prasetia.me/)

## Links

- [npm Package](https://www.npmjs.com/package/@ekaone/mask-email)
- [GitHub Repository](https://github.com/ekaone/mask-email)
- [Issue Tracker](https://github.com/ekaone/mask-email/issues)

---

⭐ If this library helps you, please consider giving it a star on GitHub!
