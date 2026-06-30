-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "on_chain_id" INTEGER NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "client" VARCHAR(42) NOT NULL,
    "executor" VARCHAR(42),
    "reward" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "metadata_hash" VARCHAR(66) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "contact_info" VARCHAR(500) NOT NULL,
    "reference_link" VARCHAR(500),
    "category" VARCHAR(100),
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "client_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "executor_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "payout_wei" TEXT,
    "fee_wei" TEXT,
    "disputed_by" VARCHAR(42),
    "dispute_client_refund" TEXT,
    "dispute_executor_payout" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "applicant" VARCHAR(42) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "author" VARCHAR(42) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "sender" VARCHAR(42) NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "file_url" VARCHAR(500),
    "file_name" VARCHAR(255),
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" SERIAL NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "recipient" VARCHAR(42) NOT NULL,
    "amount" TEXT NOT NULL,
    "block_number" INTEGER NOT NULL,
    "tx_hash" VARCHAR(66) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_state" (
    "chain_id" INTEGER NOT NULL,
    "last_block_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("chain_id")
);

-- CreateIndex
CREATE INDEX "tasks_chain_id_idx" ON "tasks"("chain_id");

-- CreateIndex
CREATE INDEX "tasks_client_idx" ON "tasks"("client");

-- CreateIndex
CREATE INDEX "tasks_executor_idx" ON "tasks"("executor");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_category_idx" ON "tasks"("category");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_on_chain_id_chain_id_key" ON "tasks"("on_chain_id", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_task_id_applicant_key" ON "applications"("task_id", "applicant");

-- CreateIndex
CREATE INDEX "dispute_messages_task_id_idx" ON "dispute_messages"("task_id");

-- CreateIndex
CREATE INDEX "withdrawals_chain_id_recipient_idx" ON "withdrawals"("chain_id", "recipient");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

