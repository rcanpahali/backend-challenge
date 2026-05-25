import { Task } from "../models/Task";
import { Result } from "../models/Result";

export interface ITaskResultRepository {
  // Returns all tasks for a workflow, ordered by stepNumber ASC
  findTasksByWorkflow(workflowId: string): Promise<Task[]>;
  findResultById(resultId: string): Promise<Result | null>;
}
