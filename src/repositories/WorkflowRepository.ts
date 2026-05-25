import { DataSource } from "typeorm";
import { Workflow } from "../models/Workflow";
import { Result } from "../models/Result";
import { IWorkflowRepository } from "./IWorkflowRepository";
import { WorkflowStatus } from "../workflows/WorkflowFactory";
import { TaskStatus } from "../types/TaskStatus";

export class WorkflowRepository implements IWorkflowRepository {
  constructor(private dataSource: DataSource) {}

  findById(workflowId: string): Promise<Workflow | null> {
    return this.dataSource.getRepository(Workflow).findOne({ where: { workflowId } });
  }

  findWithTasks(workflowId: string): Promise<Workflow | null> {
    return this.dataSource.getRepository(Workflow).findOne({
      where: { workflowId },
      relations: { tasks: true }
    });
  }

  async syncStatus(workflowId: string): Promise<void> {
    const workflow = await this.findWithTasks(workflowId);
    if (!workflow) {
      return;
    }

    workflow.status = workflow.deriveStatus();

    if (workflow.status === WorkflowStatus.Completed || workflow.status === WorkflowStatus.Failed) {
      workflow.finalResult = await this.aggregateResults(workflow);
    }

    await this.save(workflow);
  }

  private async aggregateResults(workflow: Workflow): Promise<string> {
    const resultRepo = this.dataSource.getRepository(Result);

    const taskSummaries = await Promise.all(
      workflow.tasks.map(async task => {
        const result = task.resultId
          ? await resultRepo.findOne({ where: { resultId: task.resultId } })
          : null;

        return {
          taskId: task.taskId,
          taskType: task.taskType,
          stepNumber: task.stepNumber,
          status: task.status,
          output: result?.data ? (JSON.parse(result.data) as unknown) : null,
          error:
            task.status === TaskStatus.Failed ? (task.errorMessage ?? "Task failed") : undefined
        };
      })
    );

    return JSON.stringify({
      workflowId: workflow.workflowId,
      tasks: taskSummaries
    });
  }

  save(workflow: Workflow): Promise<Workflow> {
    return this.dataSource.getRepository(Workflow).save(workflow);
  }
}
