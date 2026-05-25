import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from "typeorm";
import { Workflow } from "./Workflow";
import { TaskStatus } from "../types/TaskStatus";

@Entity({ name: "tasks" })
export class Task {
  @PrimaryGeneratedColumn("uuid")
  taskId!: string;

  @Column()
  clientId!: string;

  @Column("text")
  payload!: string;

  @Column({ type: "text" })
  status!: TaskStatus;

  @Column({ nullable: true, type: "text" })
  progress?: string | null;

  @Column({ nullable: true })
  resultId?: string;

  @Column()
  taskType!: string;

  @Column({ default: 1 })
  stepNumber!: number;

  @Column({ nullable: true, type: "text" })
  dependencyTaskId?: string | null;

  @ManyToOne(() => Task, { nullable: true, eager: false })
  @JoinColumn({ name: "dependencyTaskId" })
  dependency?: Task | null;

  @ManyToOne(() => Workflow, workflow => workflow.tasks)
  workflow!: Workflow;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
