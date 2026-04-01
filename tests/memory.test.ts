import { describe, it, expect } from "vitest";
import { createMemoryStore } from "../src/store/memory.js";
import type { AgentTask } from "../src/types.js";

function makeTask(
  id: string,
  status: AgentTask["status"] = "done",
  to = "agent",
): AgentTask {
  return {
    id,
    from: "coordinator",
    to,
    input: null,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("createMemoryStore", () => {
  it("saves and finds a task by id", async () => {
    const store = createMemoryStore();
    await store.save(makeTask("1"));
    const found = await store.find("1");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("1");
  });

  it("returns null for unknown id", async () => {
    const store = createMemoryStore();
    expect(await store.find("nope")).toBeNull();
  });

  it("lists all tasks", async () => {
    const store = createMemoryStore();
    await store.save(makeTask("1"));
    await store.save(makeTask("2"));
    const all = await store.list();
    expect(all).toHaveLength(2);
  });

  it("filters by status", async () => {
    const store = createMemoryStore();
    await store.save(makeTask("1", "done"));
    await store.save(makeTask("2", "failed"));
    await store.save(makeTask("3", "pending"));
    const failed = await store.list({ status: "failed" });
    expect(failed).toHaveLength(1);
    expect(failed[0]!.id).toBe("2");
  });

  it("filters by agent name", async () => {
    const store = createMemoryStore();
    await store.save(makeTask("1", "done", "npm"));
    await store.save(makeTask("2", "done", "deploy"));
    const npmTasks = await store.list({ to: "npm" });
    expect(npmTasks).toHaveLength(1);
    expect(npmTasks[0]!.to).toBe("npm");
  });

  it("overwrites task on repeated save (same id)", async () => {
    const store = createMemoryStore();
    await store.save(makeTask("1", "pending"));
    await store.save({ ...makeTask("1"), status: "done" });
    const found = await store.find("1");
    expect(found!.status).toBe("done");
  });

  it("clears all tasks", async () => {
    const store = createMemoryStore();
    await store.save(makeTask("1"));
    await store.save(makeTask("2"));
    await store.clear();
    expect(await store.list()).toHaveLength(0);
  });
});
