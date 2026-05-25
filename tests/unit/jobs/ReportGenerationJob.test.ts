import { describe, it, expect } from "vitest";
import { ReportGenerationJob } from "../../../src/jobs/ReportGenerationJob";
import { Task } from "../../../src/models/Task";
import { Result } from "../../../src/models/Result";
import { TaskStatus } from "../../../src/types/TaskStatus";
import { ITaskResultRepository } from "../../../src/repositories/ITaskResultRepository";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: "report-task-id",
    clientId: "test-client",
    taskType: "report",
    status: TaskStatus.InProgress,
    stepNumber: 3,
    payload: JSON.stringify({}),
    workflow: { workflowId: "test-workflow-id" },
    ...overrides
  } as Task;
}

function makePrecedingTask(step: number, status: TaskStatus, resultId?: string): Task {
  return {
    taskId: `task-step-${step}`,
    taskType: "analysis",
    status,
    stepNumber: step,
    resultId,
    workflow: { workflowId: "test-workflow-id" }
  } as Task;
}

function makeRepo(
  allTasks: Task[],
  resultsByResultId: Record<string, Result>
): ITaskResultRepository {
  return {
    findTasksByWorkflow: () => Promise.resolve(allTasks),
    findResultById: (id: string) => Promise.resolve(resultsByResultId[id] ?? null)
  };
}

describe("ReportGenerationJob", () => {
  it("aggregates results from all preceding tasks", async () => {
    const precedingTask1 = makePrecedingTask(1, TaskStatus.Completed, "result-1");
    const precedingTask2 = makePrecedingTask(2, TaskStatus.Completed, "result-2");
    const reportTask = makeTask({ stepNumber: 3 });

    const result1: Result = {
      resultId: "result-1",
      taskId: "task-step-1",
      data: JSON.stringify({ value: 42 }),
      createdAt: new Date()
    };
    const result2: Result = {
      resultId: "result-2",
      taskId: "task-step-2",
      data: JSON.stringify({ sent: true }),
      createdAt: new Date()
    };

    const repo = makeRepo([precedingTask1, precedingTask2, reportTask], {
      "result-1": result1,
      "result-2": result2
    });
    const job = new ReportGenerationJob(repo);
    const output = (await job.run(reportTask)) as {
      workflowId: string;
      tasks: { taskId: string; type: string; output: unknown }[];
      finalReport: { totalTasks: number; taskTypes: string[]; completedAt: string };
    };

    expect(output.workflowId).toBe("test-workflow-id");
    expect(output.tasks).toHaveLength(2);
    expect(output.tasks[0]).toMatchObject({
      taskId: "task-step-1",
      type: "analysis",
      output: { value: 42 }
    });
    expect(output.tasks[1]).toMatchObject({
      taskId: "task-step-2",
      type: "analysis",
      output: { sent: true }
    });
    expect(output.finalReport.totalTasks).toBe(2);
    expect(output.finalReport.taskTypes).toEqual(["analysis", "analysis"]);
    expect(output.finalReport.completedAt).toBeTypeOf("string");
  });

  it("returns null output for a preceding task with no result", async () => {
    const taskWithNoResult = makePrecedingTask(1, TaskStatus.Completed);
    const reportTask = makeTask({ stepNumber: 2 });

    const repo = makeRepo([taskWithNoResult, reportTask], {});
    const job = new ReportGenerationJob(repo);
    const output = (await job.run(reportTask)) as {
      tasks: { output: unknown }[];
    };

    expect(output.tasks[0].output).toBeNull();
  });
});
