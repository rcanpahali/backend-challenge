import { describe, it, expect, vi, afterEach } from "vitest";
import { Repository } from "typeorm";
import { TaskRunner } from "../../../src/workers/taskRunner";
import { TaskStatus } from "../../../src/types/TaskStatus";
import { Task } from "../../../src/models/Task";
import { Result } from "../../../src/models/Result";
import * as JobFactory from "../../../src/jobs/JobFactory";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeMockRepo(options: { resultFindOne?: ReturnType<typeof vi.fn> } = {}) {
  const savedStatuses: TaskStatus[] = [];
  const resultFindOne = options.resultFindOne ?? vi.fn().mockResolvedValue(null);

  const mockRepo = {
    save: vi.fn().mockImplementation((task: Task) => {
      savedStatuses.push(task.status);
      return task;
    }),
    manager: {
      getRepository: vi.fn().mockImplementation((entity: unknown) => {
        if (entity === Result) {
          return {
            save: vi.fn().mockImplementation((r: Result) => r),
            findOne: resultFindOne
          };
        }
        // Workflow repo
        return {
          save: vi.fn().mockResolvedValue(undefined),
          findOne: vi.fn().mockResolvedValue(null)
        };
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

  it("enriches task payload with dependency output before running the job", async () => {
    const depResult: Result = {
      resultId: "dep-result-id",
      taskId: "dep-task-id",
      data: JSON.stringify({ country: "Brazil" }),
      createdAt: new Date()
    };

    const { mockRepo } = makeMockRepo({
      resultFindOne: vi.fn().mockResolvedValue(depResult)
    });

    vi.spyOn(JobFactory, "getJobForTaskType").mockReturnValue({
      run: vi.fn().mockResolvedValue({ done: true })
    });

    const runner = new TaskRunner(mockRepo);
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

    const { mockRepo } = makeMockRepo();
    const runner = new TaskRunner(mockRepo);
    const originalPayload = JSON.stringify({ geoJson: {} });
    const task = makeTask({ taskType: "analysis", payload: originalPayload });

    await runner.run(task);

    expect(task.payload).toBe(originalPayload);
  });
});
