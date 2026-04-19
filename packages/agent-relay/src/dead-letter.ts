import type { AgentTask, BusInstance, DeadLetterQueue } from './types.js'

export function createDeadLetterQueue(): DeadLetterQueue {
  const queue: AgentTask[] = []

  return {
    push(task) {
      queue.push({ ...task })
    },

    drain() {
      return queue.splice(0, queue.length)
    },

    async retry(id, bus: BusInstance) {
      const idx = queue.findIndex(t => t.id === id)
      if (idx === -1) throw new Error(`Task ${id} not found in dead-letter queue`)

      const [task] = queue.splice(idx, 1)
      if (!task) throw new Error(`Task ${id} could not be removed from dead-letter queue`)

      // Re-dispatch with reset status
      const retried: AgentTask = {
        id: task.id,
        from: task.from,
        to: task.to,
        input: task.input,
        status: 'pending',
        createdAt: task.createdAt,
        updatedAt: Date.now(),
      }

      return bus.dispatch(retried)
    },
  }
}
