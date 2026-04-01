import { delegate } from './relay.js'
import { resolvePlan } from './ai/providers.js'
import type {
  AgentTask,
  BusInstance,
  CoordinatorConfig,
  CoordinatorInstance,
  DelegationPlan,
} from './types.js'

export function createCoordinator(
  bus: BusInstance,
  config: CoordinatorConfig = {}
): CoordinatorInstance {
  const continueOnError = config.continueOnError ?? false
  const maxSteps = config.maxSteps ?? 20

  async function plan(goal: string): Promise<DelegationPlan> {
    const manifest = bus.manifest()
    if (manifest.length === 0) {
      throw new Error('No agents registered on the bus. Register agents before planning.')
    }
    return resolvePlan(goal, manifest, config)
  }

  async function run(goal: string): Promise<AgentTask[]> {
    const delegationPlan = await plan(goal)
    const steps = delegationPlan.steps.slice(0, maxSteps)
    const results: AgentTask[] = []

    for (const step of steps) {
      const result = await delegate(bus, {
        from: 'coordinator',
        to: step.to,
        input: step.input,
      })

      results.push(result)

      if (result.status === 'failed' && !continueOnError) {
        break
      }
    }

    return results
  }

  return { plan, run }
}

// ─── Deterministic runner — no LLM needed ────────────────────────────────────

export interface DeterministicStep {
  to: string
  input: unknown
}

export async function runDeterministic(
  bus: BusInstance,
  steps: DeterministicStep[],
  options: { continueOnError?: boolean } = {}
): Promise<AgentTask[]> {
  const continueOnError = options.continueOnError ?? false
  const results: AgentTask[] = []

  for (const step of steps) {
    const result = await delegate(bus, {
      from: 'coordinator',
      to: step.to,
      input: step.input,
    })

    results.push(result)

    if (result.status === 'failed' && !continueOnError) {
      break
    }
  }

  return results
}
