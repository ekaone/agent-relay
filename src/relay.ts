import { makeTask } from './bus.js'
import type { AgentTask, BusInstance } from './types.js'

// ─── High-level: delegate and await result ────────────────────────────────────

export interface DelegateOptions {
  from: string
  to: string
  input: unknown
}

export async function delegate<TInput = unknown, TOutput = unknown>(
  bus: BusInstance,
  options: DelegateOptions
): Promise<AgentTask<TInput, TOutput>> {
  const task = makeTask<TInput>(options.from, options.to, options.input as TInput)
  return bus.dispatch<TInput, TOutput>(task as AgentTask<TInput, TOutput>)
}

// ─── Low-level: fire-and-forget send ─────────────────────────────────────────

export async function send<TInput = unknown>(
  bus: BusInstance,
  options: DelegateOptions
): Promise<string> {
  const task = makeTask<TInput>(options.from, options.to, options.input as TInput)
  // Save as pending — caller is responsible for dispatching
  await bus.store.save(task)
  return task.id
}

// ─── Low-level: receive a pending task by agent name ─────────────────────────

export async function receive<TInput = unknown>(
  bus: BusInstance,
  agentName: string
): Promise<AgentTask<TInput> | null> {
  const pending = await bus.store.list({ status: 'pending', to: agentName })
  if (pending.length === 0) return null
  // Return the oldest pending task (FIFO)
  return pending.sort((a, b) => a.createdAt - b.createdAt)[0] as AgentTask<TInput>
}
