// ─── Task ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed'

export interface AgentTask<TInput = unknown, TOutput = unknown> {
  id: string
  from: string
  to: string
  input: TInput
  output?: TOutput
  status: TaskStatus
  error?: Error
  createdAt: number
  updatedAt: number
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export type AgentHandler<TInput = unknown, TOutput = unknown> = (
  task: AgentTask<TInput, TOutput>
) => Promise<TOutput>

export interface AgentDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  commands?: string[] | undefined
  timeoutMs?: number | undefined
  handler: AgentHandler<TInput, TOutput>
}

export interface Agent<TInput = unknown, TOutput = unknown>
  extends AgentDefinition<TInput, TOutput> {}

// ─── Bus ─────────────────────────────────────────────────────────────────────

export interface AgentManifestEntry {
  name: string
  description: string
  commands?: string[] | undefined
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface BusStore {
  save(task: AgentTask): Promise<void>
  find(id: string): Promise<AgentTask | null>
  list(filter?: { status?: TaskStatus; to?: string }): Promise<AgentTask[]>
  clear(): Promise<void>
}

// ─── Dead-letter ─────────────────────────────────────────────────────────────

export interface DeadLetterQueue {
  push(task: AgentTask): void
  drain(): AgentTask[]
  retry(id: string, bus: BusInstance): Promise<AgentTask>
}

// ─── Bus instance ─────────────────────────────────────────────────────────────

export interface BusInstance {
  register<TInput, TOutput>(agent: Agent<TInput, TOutput>): void
  manifest(): AgentManifestEntry[]
  history(): Promise<AgentTask[]>
  dispatch<TInput, TOutput>(task: AgentTask<TInput, TOutput>): Promise<AgentTask<TInput, TOutput>>
  deadLetter: DeadLetterQueue
  store: BusStore
}

// ─── Coordinator ─────────────────────────────────────────────────────────────

export type AIProvider = 'anthropic' | 'openai' | 'ollama' | 'custom'

export interface CoordinatorConfig {
  provider?: AIProvider
  apiKey?: string
  model?: string
  baseURL?: string                          // for ollama / custom
  maxSteps?: number
  continueOnError?: boolean
  resolvePlan?: (goal: string, manifest: AgentManifestEntry[]) => Promise<DelegationPlan>
}

export interface DelegationStep {
  to: string
  input: unknown
}

export interface DelegationPlan {
  steps: DelegationStep[]
}

export interface CoordinatorInstance {
  plan(goal: string): Promise<DelegationPlan>
  run(goal: string): Promise<AgentTask[]>
}
