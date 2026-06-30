import { createChainSchema, updateChainSchema, type CreateChainInput } from './admin.validation';

describe('createChainSchema', () => {
  it('accepts a valid chain config and defaults startBlock/enabled', () => {
    const result: CreateChainInput = createChainSchema.parse({
      chainId: 11155111,
      rpcUrl: 'https://rpc.example.com',
      contractAddress: '0x000000000000000000000000000000000000dEaD',
    });
    expect(result.startBlock).toBe(0);
    expect(result.enabled).toBe(true);
  });

  it('rejects an invalid contract address', () => {
    const result: ReturnType<typeof createChainSchema.safeParse> = createChainSchema.safeParse({
      chainId: 1,
      rpcUrl: 'https://rpc.example.com',
      contractAddress: 'not-an-address',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL rpcUrl', () => {
    const result: ReturnType<typeof createChainSchema.safeParse> = createChainSchema.safeParse({
      chainId: 1,
      rpcUrl: 'not-a-url',
      contractAddress: '0x000000000000000000000000000000000000dEaD',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateChainSchema', () => {
  it('accepts a partial update with a single field', () => {
    expect(updateChainSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    expect(updateChainSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a negative startBlock', () => {
    expect(updateChainSchema.safeParse({ startBlock: -1 }).success).toBe(false);
  });
});
