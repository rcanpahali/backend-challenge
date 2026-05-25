import { DataSource } from "typeorm";
import { Task } from "../models/Task";
import { TaskStatus } from "../types/TaskStatus";
import { ITaskRepository } from "./ITaskRepository";

export class TaskRepository implements ITaskRepository {
  constructor(private dataSource: DataSource) {}

  save(task: Task): Promise<Task> {
    return this.dataSource.getRepository(Task).save(task);
  }

  findNextEligibleTask(): Promise<Task | null> {
    return this.dataSource
      .getRepository(Task)
      .createQueryBuilder("task")
      .leftJoinAndSelect("task.workflow", "workflow")
      .leftJoinAndSelect("task.dependency", "dependency")
      .where("task.status = :status", { status: TaskStatus.Queued })
      .andWhere("(task.dependencyTaskId IS NULL OR dependency.status = :depStatus)", {
        depStatus: TaskStatus.Completed
      })
      .getOne();
  }

  findTasksByWorkflow(workflowId: string): Promise<Task[]> {
    return this.dataSource.getRepository(Task).find({
      where: { workflow: { workflowId } },
      order: { stepNumber: "ASC" }
    });
  }
}
