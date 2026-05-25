import { Job } from "./Job";
import { Task } from "../models/Task";
import { TaskStatus } from "../types/TaskStatus";
import { ITaskResultRepository } from "../repositories/ITaskResultRepository";
import logger from "../logger";

export class ReportGenerationJob implements Job {
  constructor(private repo: ITaskResultRepository) {}

  async run(task: Task): Promise<unknown> {
    logger.info({ taskId: task.taskId }, "Running report generation");

    const allTasks = await this.repo.findTasksByWorkflow(task.workflow.workflowId);
    const precedingTasks = allTasks.filter(t => t.stepNumber < task.stepNumber);

    // Temporary guard: throws if any preceding task isn't completed yet, which causes TaskRunner
    // to mark this task as failed — a dead end with no retry. Task 3 (dependency system) will
    // prevent the worker from scheduling this task until predecessors are done, making this guard
    // unnecessary. Remove it once Task 3 is implemented.
    const notDone = precedingTasks.find(t => t.status !== TaskStatus.Completed);
    if (notDone) {
      throw new Error(`Task ${notDone.taskId} (step ${notDone.stepNumber}) is not yet completed`);
    }

    const taskResults = await Promise.all(
      precedingTasks.map(async t => {
        const result = t.resultId ? await this.repo.findResultById(t.resultId) : null;
        return {
          taskId: t.taskId,
          type: t.taskType,
          output: result ? (JSON.parse(result.data ?? "{}") as Record<string, unknown>) : null
        };
      })
    );

    return {
      workflowId: task.workflow.workflowId,
      tasks: taskResults,
      finalReport: {
        totalTasks: precedingTasks.length,
        taskTypes: precedingTasks.map(t => t.taskType),
        completedAt: new Date().toISOString()
      }
    };
  }
}
