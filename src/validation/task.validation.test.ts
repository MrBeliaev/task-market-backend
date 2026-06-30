import {
  createTaskSchema,
  applyToTaskSchema,
  addCommentSchema,
  updateTaskMetadataSchema,
  queryTasksSchema,
  type QueryTasksInput,
  type CreateTaskInput,
} from './task.validation';

const VALID_ADDRESS: string = '0x000000000000000000000000000000000000dEaD';

describe('createTaskSchema', () => {
  const base: CreateTaskInput = {
    onChainId: 1,
    chainId: 11155111,
    client: VALID_ADDRESS,
    signature: '0xsig',
    reward: '1000000000000000',
    deadline: new Date().toISOString(),
    metadataHash: '0xhash',
    title: 'A valid task title',
    description: 'A description that is long enough to pass validation.',
    contactInfo: 'telegram:foo',
  };

  it('accepts a valid payload', () => {
    expect(createTaskSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an invalid Ethereum address', () => {
    const result: ReturnType<typeof createTaskSchema.safeParse> = createTaskSchema.safeParse({
      ...base, client: 'not-an-address',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a title that is too short', () => {
    const result: ReturnType<typeof createTaskSchema.safeParse> = createTaskSchema.safeParse({
      ...base, title: 'hi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a description that is too short', () => {
    const result: ReturnType<typeof createTaskSchema.safeParse> = createTaskSchema.safeParse({
      ...base, description: 'too short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 skills', () => {
    const result: ReturnType<typeof createTaskSchema.safeParse> = createTaskSchema.safeParse({
      ...base,
      skills: Array.from({ length: 11 }, (_, i) => `skill-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('applyToTaskSchema', () => {
  it('accepts a valid application', () => {
    const result: ReturnType<typeof applyToTaskSchema.safeParse> = applyToTaskSchema.safeParse({
      applicant: VALID_ADDRESS,
      message: 'I would like to work on this task, thanks!',
      signature: '0xsig',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a message shorter than 10 chars', () => {
    const result: ReturnType<typeof applyToTaskSchema.safeParse> = applyToTaskSchema.safeParse({
      applicant: VALID_ADDRESS,
      message: 'short',
      signature: '0xsig',
    });
    expect(result.success).toBe(false);
  });
});

describe('addCommentSchema', () => {
  it('rejects an empty signature', () => {
    const result: ReturnType<typeof addCommentSchema.safeParse> = addCommentSchema.safeParse({
      author: VALID_ADDRESS,
      content: 'Nice work',
      signature: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateTaskMetadataSchema', () => {
  it('accepts a payload with only some optional fields set', () => {
    const result: ReturnType<typeof updateTaskMetadataSchema.safeParse> = updateTaskMetadataSchema.safeParse({
      address: VALID_ADDRESS,
      signature: '0xsig',
      title: 'An updated valid title',
    });
    expect(result.success).toBe(true);
  });
});

describe('queryTasksSchema', () => {
  it('applies default page and limit', () => {
    const result: QueryTasksInput = queryTasksSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces chainId and page from query string values', () => {
    const result: QueryTasksInput = queryTasksSchema.parse({ chainId: '11155111', page: '2', limit: '10' });
    expect(result.chainId).toBe(11155111);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('rejects an unknown status value', () => {
    const result: ReturnType<typeof queryTasksSchema.safeParse> = queryTasksSchema.safeParse({
      status: 'NOT_A_STATUS',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above 50', () => {
    const result: ReturnType<typeof queryTasksSchema.safeParse> = queryTasksSchema.safeParse({ limit: '100' });
    expect(result.success).toBe(false);
  });
});
