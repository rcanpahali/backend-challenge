import { Task } from "../models/Task";

export interface ITaskRepository {
  findNextEligibleTask(): Promise<Task | null>;
  findTasksByWorkflow(workflowId: string): Promise<Task[]>;
  save(task: Task): Promise<Task>;
}
