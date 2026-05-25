import { DataSource } from "typeorm";
import { Task } from "../models/Task";
import { TaskStatus } from "../types/TaskStatus";

export class TaskRepository {
  constructor(private dataSource: DataSource) {}

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
}
