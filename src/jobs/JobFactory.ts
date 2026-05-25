import { Job } from "./Job";
import { DataAnalysisJob } from "./DataAnalysisJob";
import { EmailNotificationJob } from "./EmailNotificationJob";
import { PolygonAreaJob } from "./PolygonAreaJob";
import { ReportGenerationJob } from "./ReportGenerationJob";
import { TaskResultRepository } from "../repositories/TaskResultRepository";
import { AppDataSource } from "../data-source";

// use repo for jobs depend on repository to keep persistence concerns out of business logic.
const taskResultRepo = new TaskResultRepository(AppDataSource);

const jobMap: Record<string, () => Job> = {
  analysis: () => new DataAnalysisJob(),
  notification: () => new EmailNotificationJob(),
  polygon_area: () => new PolygonAreaJob(),
  report: () => new ReportGenerationJob(taskResultRepo)
};

export function getJobForTaskType(taskType: string): Job {
  const jobFactory = jobMap[taskType];
  if (!jobFactory) {
    throw new Error(`No job found for task type: ${taskType}`);
  }
  return jobFactory();
}
