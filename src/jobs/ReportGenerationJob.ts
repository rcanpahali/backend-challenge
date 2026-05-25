import { Job } from "./Job";
import { Task } from "../models/Task";
import { ITaskRepository } from "../repositories/ITaskRepository";
import { IResultRepository } from "../repositories/IResultRepository";
import logger from "../logger";

export class ReportGenerationJob implements Job {
  constructor(
    private taskRepository: ITaskRepository,
    private resultRepository: IResultRepository
  ) {}

  async run(task: Task): Promise<unknown> {
    logger.info({ taskId: task.taskId }, "Running report generation");

    const allTasks = await this.taskRepository.findTasksByWorkflow(task.workflow.workflowId);
    const precedingTasks = allTasks.filter(t => t.stepNumber < task.stepNumber);

    const taskResults = await Promise.all(
      precedingTasks.map(async t => {
        const result = t.resultId ? await this.resultRepository.findById(t.resultId) : null;
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
