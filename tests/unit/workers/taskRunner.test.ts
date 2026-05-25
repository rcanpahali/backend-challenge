import { describe, it, expect, vi, afterEach } from "vitest";
import { TaskRunner } from "../../../src/workers/taskRunner";
import { TaskStatus } from "../../../src/types/TaskStatus";
import { Task } from "../../../src/models/Task";
import { Result } from "../../../src/models/Result";
import { ITaskRepository } from "../../../src/repositories/ITaskRepository";
import { IResultRepository } from "../../../src/repositories/IResultRepository";
import { IWorkflowRepository } from "../../../src/repositories/IWorkflowRepository";
import * as JobFactory from "../../../src/jobs/JobFactory";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeMocks(options: { resultFindById?: ReturnType<typeof vi.fn> } = {}) {
  const savedStatuses: TaskStatus[] = [];
  const resultFindById = options.resultFindById ?? vi.fn().mockResolvedValue(null);

  const taskRepo = {
    findNextEligibleTask: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((task: Task) => {
      savedStatuses.push(task.status);
      return Promise.resolve(task);
    })
  } as unknown as ITaskRepository;

  const resultRepo = {
    findById: resultFindById,
    save: vi.fn().mockImplementation((r: Result) => Promise.resolve(r))
  } as unknown as IResultRepository;

  const workflowRepo = {
    findWithTasks: vi.fn().mockResolvedValue(null),
    syncStatus: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined)
  } as unknown as IWorkflowRepository;

  return { taskRepo, resultRepo, workflowRepo, savedStatuses };
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
  it("marks the task as failed and stores the error message when the job throws", async () => {
    const { taskRepo, resultRepo, workflowRepo, savedStatuses } = makeMocks();
    const runner = new TaskRunner(taskRepo, resultRepo, workflowRepo);
    const task = makeTask({ payload: "not-json" });

    await expect(runner.run(task)).rejects.toThrow();

    expect(task.status).toBe(TaskStatus.Failed);
    expect(savedStatuses).toContain(TaskStatus.Failed);
    expect(task.errorMessage).toBeDefined();
    expect(typeof task.errorMessage).toBe("string");
  });

  it("enriches task payload with dependency output before running the job", async () => {
    const depResult: Result = {
      resultId: "dep-result-id",
      taskId: "dep-task-id",
      data: JSON.stringify({ country: "Brazil" }),
      createdAt: new Date()
    };

    const { taskRepo, resultRepo, workflowRepo } = makeMocks({
      resultFindById: vi.fn().mockResolvedValue(depResult)
    });

    vi.spyOn(JobFactory, "getJobForTaskType").mockReturnValue({
      run: vi.fn().mockResolvedValue({ done: true })
    });

    const runner = new TaskRunner(taskRepo, resultRepo, workflowRepo);
    const task = makeTask({
      taskType: "analysis",
      payload: JSON.stringify({ geoJson: {} }),
      dependency: { taskId: "dep-task-id", resultId: "dep-result-id" } as Task
    });

    await runner.run(task);

    const parsed = JSON.parse(task.payload) as { dependencyOutput: unknown };
    expect(parsed.dependencyOutput).toEqual({ country: "Brazil" });
  });

  it("does not modify payload when the task has no dependency", async () => {
    vi.spyOn(JobFactory, "getJobForTaskType").mockReturnValue({
      run: vi.fn().mockResolvedValue({ done: true })
    });

    const { taskRepo, resultRepo, workflowRepo } = makeMocks();
    const runner = new TaskRunner(taskRepo, resultRepo, workflowRepo);
    const originalPayload = JSON.stringify({ geoJson: {} });
    const task = makeTask({ taskType: "analysis", payload: originalPayload });

    await runner.run(task);

    expect(task.payload).toBe(originalPayload);
  });
});
