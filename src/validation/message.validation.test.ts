import { postMessageSchema } from './message.validation';

const VALID_ADDRESS: string = '0x000000000000000000000000000000000000dEaD';

describe('postMessageSchema', () => {
  it('accepts a valid message', () => {
    const result: ReturnType<typeof postMessageSchema.safeParse> = postMessageSchema.safeParse({
      sender: VALID_ADDRESS,
      content: 'Hello there',
      signature: '0xsig',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid sender address', () => {
    const result: ReturnType<typeof postMessageSchema.safeParse> = postMessageSchema.safeParse({
      sender: 'not-an-address',
      content: 'Hello there',
      signature: '0xsig',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result: ReturnType<typeof postMessageSchema.safeParse> = postMessageSchema.safeParse({
      sender: VALID_ADDRESS,
      content: '',
      signature: '0xsig',
    });
    expect(result.success).toBe(false);
  });

  it('rejects content longer than 5000 characters', () => {
    const result: ReturnType<typeof postMessageSchema.safeParse> = postMessageSchema.safeParse({
      sender: VALID_ADDRESS,
      content: 'a'.repeat(5001),
      signature: '0xsig',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing signature', () => {
    const result: ReturnType<typeof postMessageSchema.safeParse> = postMessageSchema.safeParse({
      sender: VALID_ADDRESS,
      content: 'Hello',
      signature: '',
    });
    expect(result.success).toBe(false);
  });
});
