import type { Agent, AgentDefinition } from './types.js'

export function createAgent<TInput = unknown, TOutput = unknown>(
  definition: AgentDefinition<TInput, TOutput>
): Agent<TInput, TOutput> {
  if (!definition.name || definition.name.trim() === '') {
    throw new Error('Agent name is required and must not be empty')
  }
  if (!definition.description || definition.description.trim() === '') {
    throw new Error(`Agent "${definition.name}" must have a description`)
  }
  if (typeof definition.handler !== 'function') {
    throw new Error(`Agent "${definition.name}" must have a handler function`)
  }

  const agent: Agent<TInput, TOutput> = {
    name: definition.name.trim(),
    description: definition.description.trim(),
    handler: definition.handler,
  }
  if (definition.commands !== undefined) agent.commands = definition.commands
  if (definition.timeoutMs !== undefined) agent.timeoutMs = definition.timeoutMs
  return agent
}
