import { Job } from "./Job";
import { DataAnalysisJob } from "./DataAnalysisJob";
import { EmailNotificationJob } from "./EmailNotificationJob";
import { PolygonAreaJob } from "./PolygonAreaJob";
import { ReportGenerationJob } from "./ReportGenerationJob";
import { TaskRepository } from "../repositories/TaskRepository";
import { ResultRepository } from "../repositories/ResultRepository";
import { AppDataSource } from "../data-source";

const taskRepo = new TaskRepository(AppDataSource);
const resultRepo = new ResultRepository(AppDataSource);

const jobMap: Record<string, () => Job> = {
  analysis: () => new DataAnalysisJob(),
  notification: () => new EmailNotificationJob(),
  polygon_area: () => new PolygonAreaJob(),
  report: () => new ReportGenerationJob(taskRepo, resultRepo)
};

export function getJobForTaskType(taskType: string): Job {
  const jobFactory = jobMap[taskType];
  if (!jobFactory) {
    throw new Error(`No job found for task type: ${taskType}`);
  }
  return jobFactory();
}
