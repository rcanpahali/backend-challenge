import { Workflow } from "../models/Workflow";

export interface IWorkflowRepository {
  findById(workflowId: string): Promise<Workflow | null>;
  findWithTasks(workflowId: string): Promise<Workflow | null>;
  syncStatus(workflowId: string): Promise<void>;
  save(workflow: Workflow): Promise<Workflow>;
}
