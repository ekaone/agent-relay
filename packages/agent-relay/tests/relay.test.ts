import { describe, it, expect } from 'vitest'
import { createBus } from '../src/bus.js'
import { createAgent } from '../src/agent.js'
import { delegate, send, receive } from '../src/relay.js'

describe('delegate', () => {
  it('delegates a task and returns the result', async () => {
    const bus = createBus()
    bus.register(createAgent<number, number>({
      name: 'double',
      description: 'Doubles the input',
      handler: async t => t.input * 2,
    }))

    const result = await delegate<number, number>(bus, { from: 'coordinator', to: 'double', input: 5 })
    expect(result.status).toBe('done')
    expect(result.output).toBe(10)
  })
})

describe('send / receive', () => {
  it('send enqueues a pending task, receive retrieves it FIFO', async () => {
    const bus = createBus()
    bus.register(createAgent({ name: 'worker', description: 'Worker', handler: async t => t.input }))

    await send(bus, { from: 'coordinator', to: 'worker', input: 'first' })
    await send(bus, { from: 'coordinator', to: 'worker', input: 'second' })

    const task = await receive(bus, 'worker')
    expect(task).not.toBeNull()
    expect(task!.input).toBe('first')
  })

  it('receive returns null when no pending tasks', async () => {
    const bus = createBus()
    const result = await receive(bus, 'nobody')
    expect(result).toBeNull()
  })
})
