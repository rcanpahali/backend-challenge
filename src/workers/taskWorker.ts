import { AppDataSource } from "../data-source";
import { TaskRepository } from "../repositories/TaskRepository";
import { createTaskRunner } from "./taskRunner";
import { config } from "../config";
import logger from "../logger";

export async function taskWorker() {
  const taskRepo = new TaskRepository(AppDataSource);
  const taskRunner = createTaskRunner(AppDataSource);

  while (true) {
    const task = await taskRepo.findNextEligibleTask();

    if (task) {
      try {
        await taskRunner.run(task);
      } catch (error: unknown) {
        logger.error({ err: error }, "Task execution failed; status already updated by TaskRunner");
      }
    }

    // Wait before checking for the next task again
    await new Promise(resolve => setTimeout(resolve, config.WORKER_POLL_INTERVAL_MS));
  }
}
