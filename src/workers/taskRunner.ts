import { DataSource } from "typeorm";
import { Task } from "../models/Task";
import { getJobForTaskType } from "../jobs/JobFactory";
import { Result } from "../models/Result";
import logger from "../logger";
import { TaskStatus } from "../types/TaskStatus";
import { ITaskRepository } from "../repositories/ITaskRepository";
import { IResultRepository } from "../repositories/IResultRepository";
import { IWorkflowRepository } from "../repositories/IWorkflowRepository";
import { TaskRepository } from "../repositories/TaskRepository";
import { ResultRepository } from "../repositories/ResultRepository";
import { WorkflowRepository } from "../repositories/WorkflowRepository";

export function createTaskRunner(dataSource: DataSource): TaskRunner {
  return new TaskRunner(
    new TaskRepository(dataSource),
    new ResultRepository(dataSource),
    new WorkflowRepository(dataSource)
  );
}

export class TaskRunner {
  constructor(
    private taskRepository: ITaskRepository,
    private resultRepository: IResultRepository,
    private workflowRepository: IWorkflowRepository
  ) {}

  /**
   * Runs the appropriate job based on the task's type, managing the task's status.
   * @param task - The task entity that determines which job to run.
   * @throws If the job fails, it rethrows the error.
   */
  async run(task: Task): Promise<void> {
    task.status = TaskStatus.InProgress;
    task.progress = "starting job...";
    await this.taskRepository.save(task);
    const job = getJobForTaskType(task.taskType);

    try {
      logger.info({ taskId: task.taskId, taskType: task.taskType }, "Starting job");

      if (task.dependency && task.dependency.resultId) {
        const depResult = await this.resultRepository.findById(task.dependency.resultId);
        if (depResult && depResult.data) {
          const parsed = JSON.parse(task.payload) as Record<string, unknown>;
          parsed.dependencyOutput = JSON.parse(depResult.data);
          task.payload = JSON.stringify(parsed);
        }
      }

      const taskResult = await job.run(task);
      logger.info({ taskId: task.taskId, taskType: task.taskType }, "Job completed successfully");
      const result = new Result();
      result.taskId = task.taskId!;
      result.data = JSON.stringify(taskResult || {});
      await this.resultRepository.save(result);
      task.resultId = result.resultId!;
      task.status = TaskStatus.Completed;
      task.progress = null;
      await this.taskRepository.save(task);
    } catch (error: unknown) {
      logger.error({ taskId: task.taskId, taskType: task.taskType, err: error }, "Job failed");

      task.status = TaskStatus.Failed;
      task.progress = null;
      await this.taskRepository.save(task);

      throw error;
    } finally {
      // update workflow status regardless its success level
      await this.workflowRepository.syncStatus(task.workflow.workflowId);
    }
  }
}
