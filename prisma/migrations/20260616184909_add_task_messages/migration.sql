-- CreateTable
CREATE TABLE "task_messages" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "sender" VARCHAR(42) NOT NULL,
    "content" TEXT NOT NULL,
    "file_url" VARCHAR(500),
    "file_name" VARCHAR(255),
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_messages_task_id_idx" ON "task_messages"("task_id");

-- AddForeignKey
ALTER TABLE "task_messages" ADD CONSTRAINT "task_messages_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
