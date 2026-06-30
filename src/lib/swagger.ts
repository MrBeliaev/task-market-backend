import type { JsonObject } from 'swagger-ui-express';
import { config } from './config';

type JsonSchema = Record<string, unknown>;

function refSchema (ref: string): JsonSchema {
  return { $ref: ref };
}

function arrayOfRef (ref: string): JsonSchema {
  return { type: 'array', items: { $ref: ref } };
}

function jsonResponse (description: string, schema: JsonSchema): JsonSchema {
  return { description, content: { 'application/json': { schema } } };
}

export const swaggerSpec: JsonObject = {
  openapi: '3.0.3',
  info: {
    title: 'TaskMarket API',
    version: '1.0.0',
    description:
      'REST API for TaskMarket: a decentralised freelance marketplace on Ethereum. ' +
      'All mutating endpoints require an EIP-191 wallet signature for authentication.',
  },
  servers: [{ url: `http://localhost:${config.port}`, description: 'Local' }],
  tags: [
    { name: 'Tasks',   description: 'Task CRUD and metadata' },
    { name: 'Applications', description: 'Applications to open tasks' },
    { name: 'Comments',    description: 'Task comments' },
    { name: 'Disputes',    description: 'Dispute chat (participants only)' },
    { name: 'Admin',       description: 'Admin endpoints (require on-chain ADMIN_ROLE)' },
    { name: 'Health',      description: 'Server health' },
  ],
  components: {
    schemas: {
      EthAddress: {
        type: 'string',
        pattern: '^0x[a-fA-F0-9]{40}$',
        example: '0xAbCd1234567890abcdef1234567890AbCdEf1234',
      },
      TaskStatus: {
        type: 'string',
        enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'DISPUTED', 'CANCELLED'],
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          onChainId: { type: 'integer' },
          chainId: { type: 'integer' },
          client: { $ref: '#/components/schemas/EthAddress' },
          executor: { $ref: '#/components/schemas/EthAddress', nullable: true },
          status: { $ref: '#/components/schemas/TaskStatus' },
          reward: { type: 'string', description: 'Reward in wei' },
          deadline: { type: 'string', format: 'date-time' },
          metadataHash: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          contactInfo: { type: 'string' },
          referenceLink: { type: 'string', nullable: true },
          category: { type: 'string', nullable: true },
          skills: { type: 'array', items: { type: 'string' } },
          clientConfirmed: { type: 'boolean' },
          executorConfirmed: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Application: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          taskId: { type: 'integer' },
          applicant: { $ref: '#/components/schemas/EthAddress' },
          message: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          taskId: { type: 'integer' },
          author: { $ref: '#/components/schemas/EthAddress' },
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      DisputeMessage: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          taskId: { type: 'integer' },
          sender: { $ref: '#/components/schemas/EthAddress' },
          content: { type: 'string' },
          isAdmin: { type: 'boolean' },
          fileUrl: { type: 'string', nullable: true },
          fileName: { type: 'string', nullable: true },
          fileSize: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ChainConfig: {
        type: 'object',
        properties: {
          chainId: { type: 'integer' },
          rpcUrl: { type: 'string', format: 'uri' },
          contractAddress: { $ref: '#/components/schemas/EthAddress' },
          startBlock: { type: 'integer' },
          enabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          pages: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
    parameters: {
      taskId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' },
        description: 'Task DB id',
      },
      chainId: {
        name: 'chainId',
        in: 'query',
        required: false,
        schema: { type: 'integer' },
        description: 'Filter by EVM chain id',
      },
    },
    securitySchemes: {
      AdminAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Admin-Address',
        description:
          'Admin endpoints require three headers: **X-Admin-Address** (wallet), ' +
          '**X-Admin-Signature** (EIP-191 of `admin:<timestamp>`), ' +
          '**X-Admin-Timestamp** (ms since epoch, max 5 min old), ' +
          '**X-Admin-Chain-Id** (EVM chain id of connected wallet).',
      },
    },
  },
  paths: {
    // ── Health ─────────────────────────────────────────────────────────────────
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: jsonResponse('Server is alive', {
            type: 'object',
            properties: { status: { type: 'string' }, timestamp: { type: 'string' } },
          }),
        },
      },
    },

    // ── Tasks ──────────────────────────────────────────────────────────────────
    '/api/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'List tasks',
        parameters: [
          { $ref: '#/components/parameters/chainId' },
          { name: 'status',   in: 'query', schema: { $ref: '#/components/schemas/TaskStatus' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'client',   in: 'query', schema: { $ref: '#/components/schemas/EthAddress' } },
          { name: 'executor', in: 'query', schema: { $ref: '#/components/schemas/EthAddress' } },
          { name: 'page',  in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
        ],
        responses: {
          200: jsonResponse('Paginated task list', {
            type: 'object',
            properties: {
              tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
              pagination: { $ref: '#/components/schemas/Pagination' },
            },
          }),
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Save task metadata after on-chain creation',
        description:
          'Called by the frontend after a `createTask` transaction is confirmed. ' +
          'Sign `create-task:{chainId}:{metadataHash}` with the client wallet before sending the tx.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'onChainId', 'chainId', 'client', 'signature', 'reward',
                  'deadline', 'metadataHash', 'title', 'description', 'contactInfo',
                ],
                properties: {
                  onChainId: { type: 'integer' },
                  chainId: { type: 'integer' },
                  client: { $ref: '#/components/schemas/EthAddress' },
                  signature: { type: 'string', description: 'EIP-191 sig of `create-task:{chainId}:{metadataHash}`' },
                  reward: { type: 'string', description: 'Reward in wei' },
                  deadline: { type: 'string', format: 'date-time' },
                  metadataHash: { type: 'string' },
                  title: { type: 'string', minLength: 5, maxLength: 200 },
                  description: { type: 'string', minLength: 20, maxLength: 5000 },
                  contactInfo: { type: 'string', minLength: 3, maxLength: 500 },
                  referenceLink: { type: 'string', format: 'uri', nullable: true },
                  category: { type: 'string', nullable: true },
                  skills: { type: 'array', items: { type: 'string' }, maxItems: 10 },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Task created/updated', refSchema('#/components/schemas/Task')),
          400: jsonResponse('Validation error', refSchema('#/components/schemas/Error')),
          401: jsonResponse('Invalid signature', refSchema('#/components/schemas/Error')),
        },
      },
    },
    '/api/tasks/stats': {
      get: {
        tags: ['Tasks'],
        summary: 'Task statistics (status breakdown + TVL)',
        parameters: [{ $ref: '#/components/parameters/chainId' }],
        responses: {
          200: jsonResponse('Stats', {
            type: 'object',
            properties: {
              chainId: { type: 'integer', nullable: true },
              totalTasks: { type: 'integer' },
              statusBreakdown: { type: 'object', additionalProperties: { type: 'integer' } },
              totalValueLockedWei: { type: 'string' },
            },
          }),
        },
      },
    },
    '/api/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get task by DB id',
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        responses: {
          200: jsonResponse('Task', refSchema('#/components/schemas/Task')),
          404: jsonResponse('Not found', refSchema('#/components/schemas/Error')),
        },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update task metadata (client only)',
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['address', 'signature'],
                properties: {
                  address: { $ref: '#/components/schemas/EthAddress' },
                  signature: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  contactInfo: { type: 'string' },
                  referenceLink: { type: 'string', nullable: true },
                  category: { type: 'string', nullable: true },
                  skills: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Updated task', refSchema('#/components/schemas/Task')),
          401: jsonResponse('Invalid signature', refSchema('#/components/schemas/Error')),
          403: jsonResponse('Not the client', refSchema('#/components/schemas/Error')),
        },
      },
    },
    '/api/tasks/chain/{onChainId}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get task by on-chain id + chainId',
        parameters: [
          { name: 'onChainId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'chainId', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: jsonResponse('Task', refSchema('#/components/schemas/Task')),
          404: jsonResponse('Not found', refSchema('#/components/schemas/Error')),
        },
      },
    },

    // ── Applications ───────────────────────────────────────────────────────────
    '/api/tasks/{id}/applications': {
      get: {
        tags: ['Applications'],
        summary: 'List applications for a task',
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        responses: {
          200: jsonResponse('Applications', arrayOfRef('#/components/schemas/Application')),
        },
      },
      post: {
        tags: ['Applications'],
        summary: 'Apply to a task',
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['applicant', 'message', 'signature'],
                properties: {
                  applicant: { $ref: '#/components/schemas/EthAddress' },
                  message: { type: 'string', minLength: 10, maxLength: 2000 },
                  signature: { type: 'string', description: 'EIP-191 sig of `apply:{taskId}:{message}`' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Application created', refSchema('#/components/schemas/Application')),
          400: jsonResponse('Task not open', refSchema('#/components/schemas/Error')),
          401: jsonResponse('Invalid signature', refSchema('#/components/schemas/Error')),
          409: jsonResponse('Already applied', refSchema('#/components/schemas/Error')),
        },
      },
    },

    // ── Comments ───────────────────────────────────────────────────────────────
    '/api/tasks/{id}/comments': {
      post: {
        tags: ['Comments'],
        summary: 'Add a comment to a task',
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['author', 'content', 'signature'],
                properties: {
                  author: { $ref: '#/components/schemas/EthAddress' },
                  content: { type: 'string', minLength: 1, maxLength: 2000 },
                  signature: { type: 'string', description: 'EIP-191 sig of `comment:{taskId}:{content}`' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Comment created', refSchema('#/components/schemas/Comment')),
          401: jsonResponse('Invalid signature', refSchema('#/components/schemas/Error')),
        },
      },
    },

    // ── Disputes ───────────────────────────────────────────────────────────────
    '/api/tasks/{id}/dispute': {
      get: {
        tags: ['Disputes'],
        summary: 'Get dispute messages for a task',
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        responses: {
          200: jsonResponse('Messages', arrayOfRef('#/components/schemas/DisputeMessage')),
        },
      },
      post: {
        tags: ['Disputes'],
        summary: 'Post a dispute message (client or executor only)',
        parameters: [{ $ref: '#/components/parameters/taskId' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['sender', 'content', 'signature'],
                properties: {
                  sender: { $ref: '#/components/schemas/EthAddress' },
                  content: { type: 'string' },
                  signature: { type: 'string' },
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Message created', refSchema('#/components/schemas/DisputeMessage')),
          401: jsonResponse('Invalid signature', refSchema('#/components/schemas/Error')),
          403: jsonResponse('Not a participant', refSchema('#/components/schemas/Error')),
        },
      },
    },

    // ── Admin ──────────────────────────────────────────────────────────────────
    '/api/admin/tasks': {
      get: {
        tags: ['Admin'],
        summary: 'List all tasks (admin)',
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/TaskStatus' } },
          { name: 'X-Admin-Address',   in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Signature', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Timestamp', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Chain-Id',  in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: jsonResponse('Tasks', arrayOfRef('#/components/schemas/Task')),
          401: jsonResponse('Auth error', refSchema('#/components/schemas/Error')),
          403: jsonResponse('Not admin', refSchema('#/components/schemas/Error')),
        },
      },
    },
    '/api/admin/tasks/{id}/dispute': {
      get: {
        tags: ['Admin'],
        summary: 'Get task + dispute messages (admin)',
        security: [{ AdminAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/taskId' },
          { name: 'X-Admin-Address',   in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Signature', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Timestamp', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Chain-Id',  in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: jsonResponse('Task + messages', {
            type: 'object',
            properties: {
              task: { $ref: '#/components/schemas/Task' },
              messages: { type: 'array', items: { $ref: '#/components/schemas/DisputeMessage' } },
            },
          }),
        },
      },
    },
    '/api/admin/chains': {
      get: {
        tags: ['Admin'],
        summary: 'List chain configs (admin)',
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: 'X-Admin-Address',   in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Signature', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Timestamp', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Chain-Id',  in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: jsonResponse('Chains', arrayOfRef('#/components/schemas/ChainConfig')),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Add a chain config (admin)',
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: 'X-Admin-Address',   in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Signature', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Timestamp', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Chain-Id',  in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['chainId', 'rpcUrl', 'contractAddress'],
                properties: {
                  chainId: { type: 'integer' },
                  rpcUrl: { type: 'string', format: 'uri' },
                  contractAddress: { $ref: '#/components/schemas/EthAddress' },
                  startBlock: { type: 'integer', default: 0 },
                  enabled: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Created', refSchema('#/components/schemas/ChainConfig')),
        },
      },
    },
    '/api/admin/chains/{chainId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a chain config (admin)',
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: 'chainId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'X-Admin-Address',   in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Signature', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Timestamp', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Admin-Chain-Id',  in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rpcUrl: { type: 'string', format: 'uri' },
                  contractAddress: { $ref: '#/components/schemas/EthAddress' },
                  startBlock: { type: 'integer' },
                  enabled: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Updated', refSchema('#/components/schemas/ChainConfig')),
          404: jsonResponse('Chain not found', refSchema('#/components/schemas/Error')),
        },
      },
    },
  },
};
