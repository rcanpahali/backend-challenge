import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn
} from "typeorm";
import { Task } from "./Task";
import { TaskStatus } from "../types/TaskStatus";
import { WorkflowStatus } from "../workflows/WorkflowFactory";

@Entity({ name: "workflows" })
export class Workflow {
  @PrimaryGeneratedColumn("uuid")
  workflowId!: string;

  @Column()
  clientId!: string;

  @Column({ type: "text", default: WorkflowStatus.Initial })
  status!: WorkflowStatus;

  @OneToMany(() => Task, task => task.workflow)
  tasks!: Task[];

  @Column({ nullable: true, type: "text" })
  finalResult?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  deriveStatus(): WorkflowStatus {
    // no tasks yet means workflow just started, not that it's done
    if (!this.tasks?.length) {
      return WorkflowStatus.InProgress;
    }
    if (this.tasks.some(t => t.status === TaskStatus.Failed)) {
      return WorkflowStatus.Failed;
    }
    if (this.tasks.every(t => t.status === TaskStatus.Completed)) {
      return WorkflowStatus.Completed;
    }
    return WorkflowStatus.InProgress;
  }
}
