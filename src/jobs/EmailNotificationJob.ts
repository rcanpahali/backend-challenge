import { Job } from "./Job";
import { Task } from "../models/Task";
import logger from "../logger";

export class EmailNotificationJob implements Job {
  async run(task: Task): Promise<void> {
    logger.info({ taskId: task.taskId }, "Sending email notification");
    // Perform notification work
    await new Promise(resolve => setTimeout(resolve, 500));
    logger.info({ taskId: task.taskId }, "Email sent");
  }
}
