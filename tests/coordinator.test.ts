import { describe, it, expect } from 'vitest'
import { createBus } from '../src/bus.js'
import { createAgent } from '../src/agent.js'
import { runDeterministic, createCoordinator } from '../src/coordinator.js'

function setupBus() {
  const bus = createBus()
  const log: string[] = []

  bus.register(createAgent({
    name: 'npm',
    description: 'Runs npm lifecycle commands',
    commands: ['install', 'build', 'test'],
    handler: async t => {
      const cmd = (t.input as { command: string }).command
      log.push(`npm:${cmd}`)
      return { success: true, command: cmd }
    },
  }))

  bus.register(createAgent({
    name: 'deploy',
    description: 'Runs deployment commands',
    commands: ['docker-build', 'restart'],
    handler: async t => {
      const cmd = (t.input as { command: string }).command
      log.push(`deploy:${cmd}`)
      return { success: true, command: cmd }
    },
  }))

  return { bus, log }
}

describe('runDeterministic', () => {
  it('executes steps in order and returns all results', async () => {
    const { bus, log } = setupBus()

    const results = await runDeterministic(bus, [
      { to: 'npm',    input: { command: 'install' } },
      { to: 'npm',    input: { command: 'build' } },
      { to: 'deploy', input: { command: 'restart' } },
    ])

    expect(log).toEqual(['npm:install', 'npm:build', 'deploy:restart'])
    expect(results).toHaveLength(3)
    expect(results.every(r => r.status === 'done')).toBe(true)
  })

  it('stops on first failure by default', async () => {
    const bus = createBus()
    const log: string[] = []

    bus.register(createAgent({ name: 'a', description: 'A', handler: async () => { log.push('a'); return null } }))
    bus.register(createAgent({ name: 'b', description: 'B', handler: async () => { throw new Error('b failed') } }))
    bus.register(createAgent({ name: 'c', description: 'C', handler: async () => { log.push('c'); return null } }))

    const results = await runDeterministic(bus, [
      { to: 'a', input: null },
      { to: 'b', input: null },
      { to: 'c', input: null },
    ])

    expect(log).toEqual(['a'])
    expect(results).toHaveLength(2) // a (done) + b (failed), c never ran
    expect(results[1]!.status).toBe('failed')
  })

  it('continues past failures when continueOnError is true', async () => {
    const bus = createBus()
    const log: string[] = []

    bus.register(createAgent({ name: 'a', description: 'A', handler: async () => { log.push('a'); return null } }))
    bus.register(createAgent({ name: 'b', description: 'B', handler: async () => { throw new Error('b failed') } }))
    bus.register(createAgent({ name: 'c', description: 'C', handler: async () => { log.push('c'); return null } }))

    await runDeterministic(bus, [
      { to: 'a', input: null },
      { to: 'b', input: null },
      { to: 'c', input: null },
    ], { continueOnError: true })

    expect(log).toEqual(['a', 'c'])
  })
})

describe('createCoordinator', () => {
  it('throws when no agents registered', async () => {
    const bus = createBus()
    const coordinator = createCoordinator(bus, {
      provider: 'anthropic',
      apiKey: 'test',
    })
    await expect(coordinator.plan('do something')).rejects.toThrow('No agents registered')
  })

  it('uses custom resolvePlan when provided', async () => {
    const { bus, log } = setupBus()

    const coordinator = createCoordinator(bus, {
      resolvePlan: async () => ({
        steps: [
          { to: 'npm',    input: { command: 'build' } },
          { to: 'deploy', input: { command: 'restart' } },
        ],
      }),
    })

    const results = await coordinator.run('build and deploy')
    expect(log).toEqual(['npm:build', 'deploy:restart'])
    expect(results).toHaveLength(2)
    expect(results.every(r => r.status === 'done')).toBe(true)
  })
})
