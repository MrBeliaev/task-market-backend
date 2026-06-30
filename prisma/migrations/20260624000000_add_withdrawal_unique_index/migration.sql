-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_chain_tx_recipient_key" ON "withdrawals"("chain_id", "tx_hash", "recipient");
