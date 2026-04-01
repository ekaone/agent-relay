import { describe, it, expect } from 'vitest'
import { createAgent } from '../src/agent.js'

describe('createAgent', () => {
  it('creates a valid agent', () => {
    const agent = createAgent<string, string>({
      name: 'echo',
      description: 'Echoes input',
      handler: async t => t.input,
    })
    expect(agent.name).toBe('echo')
    expect(agent.description).toBe('Echoes input')
    expect(typeof agent.handler).toBe('function')
  })

  it('trims name and description whitespace', () => {
    const agent = createAgent({
      name: '  trimmed  ',
      description: '  also trimmed  ',
      handler: async () => null,
    })
    expect(agent.name).toBe('trimmed')
    expect(agent.description).toBe('also trimmed')
  })

  it('throws on empty name', () => {
    expect(() =>
      createAgent({ name: '', description: 'desc', handler: async () => null })
    ).toThrow('Agent name is required')
  })

  it('throws on empty description', () => {
    expect(() =>
      createAgent({ name: 'agent', description: '', handler: async () => null })
    ).toThrow('must have a description')
  })

  it('sets optional commands and timeoutMs when provided', () => {
    const agent = createAgent({
      name: 'npm',
      description: 'npm agent',
      commands: ['build', 'test'],
      timeoutMs: 5000,
      handler: async () => null,
    })
    expect(agent.commands).toEqual(['build', 'test'])
    expect(agent.timeoutMs).toBe(5000)
  })

  it('does not set commands or timeoutMs when not provided', () => {
    const agent = createAgent({
      name: 'minimal',
      description: 'minimal agent',
      handler: async () => null,
    })
    expect(agent.commands).toBeUndefined()
    expect(agent.timeoutMs).toBeUndefined()
  })
})
