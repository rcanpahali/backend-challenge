import { DataSource } from "typeorm";
import { Task } from "../models/Task";
import { Result } from "../models/Result";
import { ITaskResultRepository } from "./ITaskResultRepository";

export class TaskResultRepository implements ITaskResultRepository {
  constructor(private dataSource: DataSource) {}

  findTasksByWorkflow(workflowId: string): Promise<Task[]> {
    return this.dataSource.getRepository(Task).find({
      where: { workflow: { workflowId } },
      order: { stepNumber: "ASC" }
    });
  }

  findResultById(resultId: string): Promise<Result | null> {
    return this.dataSource.getRepository(Result).findOne({
      where: { resultId }
    });
  }
}
