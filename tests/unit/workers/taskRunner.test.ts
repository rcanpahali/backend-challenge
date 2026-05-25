import { describe, it, expect, vi } from "vitest";
import { Repository } from "typeorm";
import { TaskRunner } from "../../../src/workers/taskRunner";
import { TaskStatus } from "../../../src/types/TaskStatus";
import { Task } from "../../../src/models/Task";

function makeMockRepo() {
  const savedStatuses: TaskStatus[] = [];

  const mockRepo = {
    save: vi.fn().mockImplementation((task: Task) => {
      savedStatuses.push(task.status);
      return task;
    }),
    manager: {
      getRepository: vi.fn().mockReturnValue({
        save: vi.fn().mockResolvedValue(undefined),
        findOne: vi.fn().mockResolvedValue(null)
      })
    }
  } as unknown as Repository<Task>;

  return { mockRepo, savedStatuses };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: "test-task-id",
    clientId: "test-client",
    taskType: "polygon_area",
    status: TaskStatus.Queued,
    stepNumber: 1,
    payload: JSON.stringify({}),
    workflow: { workflowId: "test-workflow-id" },
    ...overrides
  } as Task;
}

describe("TaskRunner", () => {
  it("marks the task as failed when the job throws", async () => {
    const { mockRepo, savedStatuses } = makeMockRepo();
    const runner = new TaskRunner(mockRepo);
    const task = makeTask({ payload: "not-json" });

    await expect(runner.run(task)).rejects.toThrow();

    expect(task.status).toBe(TaskStatus.Failed);
    expect(savedStatuses).toContain(TaskStatus.Failed);
  });
});
