import { describe, it, expect, vi } from 'vitest'
import { createBus } from '../src/bus.js'
import { createAgent } from '../src/agent.js'

describe('createBus', () => {
  it('registers an agent and returns it in manifest', () => {
    const bus = createBus()
    const agent = createAgent({ name: 'echo', description: 'Echoes input', handler: async t => t.input })
    bus.register(agent)
    const manifest = bus.manifest()
    expect(manifest).toHaveLength(1)
    expect(manifest[0]!.name).toBe('echo')
  })

  it('throws when registering duplicate agent names', () => {
    const bus = createBus()
    const agent = createAgent({ name: 'echo', description: 'Echo', handler: async t => t.input })
    bus.register(agent)
    expect(() => bus.register(agent)).toThrow('already registered')
  })

  it('dispatches task to correct agent and returns done status', async () => {
    const bus = createBus()
    const agent = createAgent<string, string>({
      name: 'upper',
      description: 'Uppercases input',
      handler: async t => t.input.toUpperCase(),
    })
    bus.register(agent)

    const task = {
      id: '1', from: 'test', to: 'upper',
      input: 'hello', status: 'pending' as const,
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    const result = await bus.dispatch(task)
    expect(result.status).toBe('done')
    expect(result.output).toBe('HELLO')
  })

  it('marks task as failed and pushes to DLQ when agent throws', async () => {
    const bus = createBus()
    const agent = createAgent({
      name: 'boom',
      description: 'Always fails',
      handler: async () => { throw new Error('intentional') },
    })
    bus.register(agent)

    const task = {
      id: '2', from: 'test', to: 'boom',
      input: null, status: 'pending' as const,
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    const result = await bus.dispatch(task)
    expect(result.status).toBe('failed')
    expect(result.error?.message).toBe('intentional')

    const dlq = bus.deadLetter.drain()
    expect(dlq).toHaveLength(1)
    expect(dlq[0]!.id).toBe('2')
  })

  it('fails task when no agent found for target name', async () => {
    const bus = createBus()
    const task = {
      id: '3', from: 'test', to: 'ghost',
      input: null, status: 'pending' as const,
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    const result = await bus.dispatch(task)
    expect(result.status).toBe('failed')
    expect(result.error?.message).toContain('ghost')
  })

  it('times out slow agents', async () => {
    const bus = createBus({ defaultTimeoutMs: 50 })
    const agent = createAgent({
      name: 'slow',
      description: 'Takes forever',
      handler: () => new Promise(r => setTimeout(r, 500)),
    })
    bus.register(agent)

    const task = {
      id: '4', from: 'test', to: 'slow',
      input: null, status: 'pending' as const,
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    const result = await bus.dispatch(task)
    expect(result.status).toBe('failed')
    expect(result.error?.message).toContain('timed out')
  })

  it('stores and retrieves task history', async () => {
    const bus = createBus()
    const agent = createAgent({ name: 'noop', description: 'Does nothing', handler: async () => null })
    bus.register(agent)

    const task = {
      id: '5', from: 'test', to: 'noop',
      input: null, status: 'pending' as const,
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    await bus.dispatch(task)
    const history = await bus.history()
    expect(history.length).toBeGreaterThan(0)
  })
})
