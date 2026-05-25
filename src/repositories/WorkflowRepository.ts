import { DataSource } from "typeorm";
import { Workflow } from "../models/Workflow";
import { IWorkflowRepository } from "./IWorkflowRepository";

export class WorkflowRepository implements IWorkflowRepository {
  constructor(private dataSource: DataSource) {}

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
    await this.save(workflow);
  }

  save(workflow: Workflow): Promise<Workflow> {
    return this.dataSource.getRepository(Workflow).save(workflow);
  }
}
