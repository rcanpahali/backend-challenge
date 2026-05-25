import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { AppDataSource } from "../../src/data-source";
import { Task } from "../../src/models/Task";
import { TaskStatus } from "../../src/types/TaskStatus";

export const VALID_GEO_JSON = {
  type: "Polygon",
  coordinates: [
    [
      [-63.624885020050996, -10.311050368263523],
      [-63.624885020050996, -10.367865108370523],
      [-63.61278302732815, -10.367865108370523],
      [-63.61278302732815, -10.311050368263523],
      [-63.624885020050996, -10.311050368263523]
    ]
  ]
};

export function writeYaml(content: string): string {
  const file = path.join(os.tmpdir(), `test-workflow-${Date.now()}-${Math.random()}.yml`);
  fs.writeFileSync(file, content, "utf8");
  return file;
}

export async function findEligibleQueuedTask(workflowId: string): Promise<Task | null> {
  const taskRepo = AppDataSource.getRepository(Task);
  return taskRepo
    .createQueryBuilder("task")
    .leftJoinAndSelect("task.workflow", "workflow")
    .leftJoinAndSelect("task.dependency", "dependency")
    .where("task.status = :status", { status: TaskStatus.Queued })
    .andWhere("workflow.workflowId = :workflowId", { workflowId })
    .andWhere("(task.dependencyTaskId IS NULL OR dependency.status = :depStatus)", {
      depStatus: TaskStatus.Completed
    })
    .getOne();
}
