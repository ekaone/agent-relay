import { randomUUID } from 'node:crypto'
import { createDeadLetterQueue } from './dead-letter.js'
import { createMemoryStore } from './store/memory.js'
import type {
  Agent,
  AgentManifestEntry,
  AgentTask,
  BusInstance,
  BusStore,
} from './types.js'

export interface BusOptions {
  store?: BusStore
  defaultTimeoutMs?: number
}

export function createBus(options: BusOptions = {}): BusInstance {
  const store = options.store ?? createMemoryStore()
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000
  const registry = new Map<string, Agent>()
  const deadLetter = createDeadLetterQueue()

  function register<TInput, TOutput>(agent: Agent<TInput, TOutput>): void {
    if (registry.has(agent.name)) {
      throw new Error(`Agent "${agent.name}" is already registered on this bus`)
    }
    registry.set(agent.name, agent as Agent)
  }

  function manifest(): AgentManifestEntry[] {
    return [...registry.values()].map(a => ({
      name: a.name,
      description: a.description,
      commands: a.commands,
    }))
  }

  async function history(): Promise<AgentTask[]> {
    return store.list()
  }

  async function dispatch<TInput, TOutput>(
    task: AgentTask<TInput, TOutput>
  ): Promise<AgentTask<TInput, TOutput>> {
    const agent = registry.get(task.to) as Agent<TInput, TOutput> | undefined

    if (!agent) {
      const failed: AgentTask<TInput, TOutput> = {
        ...task,
        status: 'failed',
        error: new Error(`No agent registered with name "${task.to}"`),
        updatedAt: Date.now(),
      }
      await store.save(failed)
      deadLetter.push(failed)
      return failed
    }

    // Mark running
    const running: AgentTask<TInput, TOutput> = {
      ...task,
      status: 'running',
      updatedAt: Date.now(),
    }
    await store.save(running)

    const timeoutMs = agent.timeoutMs ?? defaultTimeoutMs

    try {
      const output = await Promise.race([
        agent.handler(running),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Agent "${task.to}" timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ])

      const done: AgentTask<TInput, TOutput> = {
        ...running,
        output,
        status: 'done',
        updatedAt: Date.now(),
      }
      await store.save(done)
      return done
    } catch (err) {
      const failed: AgentTask<TInput, TOutput> = {
        ...running,
        status: 'failed',
        error: err instanceof Error ? err : new Error(String(err)),
        updatedAt: Date.now(),
      }
      await store.save(failed)
      deadLetter.push(failed)
      return failed
    }
  }

  return { register, manifest, history, dispatch, deadLetter, store }
}

// ─── Internal helper used by relay.ts ────────────────────────────────────────

export function makeTask<TInput>(
  from: string,
  to: string,
  input: TInput
): AgentTask<TInput> {
  const now = Date.now()
  return {
    id: randomUUID(),
    from,
    to,
    input,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
}
