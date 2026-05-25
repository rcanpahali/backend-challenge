import { Workflow } from "../models/Workflow";

export interface IWorkflowRepository {
  findWithTasks(workflowId: string): Promise<Workflow | null>;
  syncStatus(workflowId: string): Promise<void>;
  save(workflow: Workflow): Promise<Workflow>;
}
