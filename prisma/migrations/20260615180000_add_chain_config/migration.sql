-- CreateTable
CREATE TABLE "chain_config" (
    "chain_id" INTEGER NOT NULL,
    "rpc_url" TEXT NOT NULL,
    "contract_address" VARCHAR(42) NOT NULL,
    "start_block" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_config_pkey" PRIMARY KEY ("chain_id")
);
