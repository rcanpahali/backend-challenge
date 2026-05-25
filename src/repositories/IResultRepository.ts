import { Result } from "../models/Result";

export interface IResultRepository {
  findById(resultId: string): Promise<Result | null>;
  save(result: Result): Promise<Result>;
}
