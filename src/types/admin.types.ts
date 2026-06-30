export interface ChainRpcConfig {
  rpcUrl: string;
  contractAddress: string;
}

export interface AdminAuthHeaders {
  address: string;
  signature: string;
  timestamp: number;
  chainId: number;
}
