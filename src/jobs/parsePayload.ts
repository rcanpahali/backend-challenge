import { Task } from "../models/Task";

export function parsePayload<T>(task: Task): T {
  try {
    return JSON.parse(task.payload) as T;
  } catch (e) {
    throw new Error(`Failed to parse task payload: ${(e as Error).message}`, { cause: e });
  }
}
