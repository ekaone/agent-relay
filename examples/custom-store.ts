/**
 * Example: Custom persistent store
 *
 * Shows how to implement BusStore with any backend.
 * This example uses a simple JSON file — swap for SQLite, Redis, etc.
 *
 * Run: npx tsx examples/custom-store.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import {
  createBus,
  createAgent,
  delegate,
  type BusStore,
  type AgentTask,
  type TaskStatus,
} from '../src/index.js'

// ─── JSON file store — drop-in BusStore implementation ───────────────────────

function createJsonFileStore(path: string): BusStore {
  function load(): Record<string, AgentTask> {
    if (!existsSync(path)) return {}
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, AgentTask>
  }

  function flush(tasks: Record<string, AgentTask>): void {
    writeFileSync(path, JSON.stringify(tasks, null, 2))
  }

  return {
    async save(task) {
      const tasks = load()
      tasks[task.id] = task
      flush(tasks)
    },

    async find(id) {
      const tasks = load()
      return tasks[id] ?? null
    },

    async list(filter) {
      let results = Object.values(load())
      if (filter?.status) results = results.filter(t => t.status === filter.status)
      if (filter?.to)     results = results.filter(t => t.to === filter.to)
      return results
    },

    async clear() {
      flush({})
    },
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const store = createJsonFileStore('./agent-relay-tasks.json')

  const bus = createBus({ store })

  bus.register(createAgent<string, string>({
    name: 'greeter',
    description: 'Greets the input name',
    handler: async task => `Hello, ${task.input}!`,
  }))

  console.log('\n🗄️  Using JSON file store: ./agent-relay-tasks.json\n')

  await delegate(bus, { from: 'coordinator', to: 'greeter', input: 'Eka' })
  await delegate(bus, { from: 'coordinator', to: 'greeter', input: 'World' })

  const history = await bus.history()
  console.log(`Tasks persisted: ${history.length}`)
  console.log(history.map(t => `  [${t.status}] ${t.to} → ${String(t.output)}`).join('\n'))
  console.log('\nCheck agent-relay-tasks.json to see the persisted tasks.')
}

main().catch(console.error)
