import { AppDataSource } from "../data-source";
import { Task } from "../models/Task";
import { TaskRunner, TaskStatus } from "./taskRunner";
import { config } from "../config";
import logger from "../logger";

export async function taskWorker() {
  const taskRepository = AppDataSource.getRepository(Task);
  const taskRunner = new TaskRunner(taskRepository);

  while (true) {
    const task = await taskRepository.findOne({
      where: { status: TaskStatus.Queued },
      relations: {
        workflow: true
      } // Ensure workflow is loaded
    });

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
