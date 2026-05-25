import { DataSource } from "typeorm";
import { Result } from "../models/Result";
import { IResultRepository } from "./IResultRepository";

export class ResultRepository implements IResultRepository {
  constructor(private dataSource: DataSource) {}

  findById(resultId: string): Promise<Result | null> {
    return this.dataSource.getRepository(Result).findOne({ where: { resultId } });
  }

  save(result: Result): Promise<Result> {
    return this.dataSource.getRepository(Result).save(result);
  }
}
