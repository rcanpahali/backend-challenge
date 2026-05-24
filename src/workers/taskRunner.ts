import { Repository } from "typeorm";
import { Task } from "../models/Task";
import { getJobForTaskType } from "../jobs/JobFactory";
import { WorkflowStatus } from "../workflows/WorkflowFactory";
import { Workflow } from "../models/Workflow";
import { Result } from "../models/Result";
import logger from "../logger";

export enum TaskStatus {
  Queued = "queued",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed"
}

export class TaskRunner {
  constructor(private taskRepository: Repository<Task>) {}

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
      const resultRepository = this.taskRepository.manager.getRepository(Result);
      const taskResult = await job.run(task);
      logger.info({ taskId: task.taskId, taskType: task.taskType }, "Job completed successfully");
      const result = new Result();
      result.taskId = task.taskId!;
      result.data = JSON.stringify(taskResult || {});
      await resultRepository.save(result);
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
    }

    const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
    const currentWorkflow = await workflowRepository.findOne({
      where: { workflowId: task.workflow.workflowId },
      relations: {
        tasks: true
      }
    });

    if (currentWorkflow) {
      const allCompleted = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
      const anyFailed = currentWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

      if (anyFailed) {
        currentWorkflow.status = WorkflowStatus.Failed;
      } else if (allCompleted) {
        currentWorkflow.status = WorkflowStatus.Completed;
      } else {
        currentWorkflow.status = WorkflowStatus.InProgress;
      }

      await workflowRepository.save(currentWorkflow);
    }
  }
}
