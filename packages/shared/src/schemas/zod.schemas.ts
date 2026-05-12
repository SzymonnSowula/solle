import { z } from 'zod';

export const SessionCreateSchema = z.object({
  userId: z.string().uuid().optional(),
  input: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const SessionUpdateSchema = z.object({
  status: z.enum(['created', 'active', 'running', 'completed', 'failed', 'cancelled']).optional(),
  intent: z
    .enum(['RESEARCH', 'INBOX', 'PLANNING', 'APPLICATION', 'GENERAL', 'DESKTOP'])
    .optional(),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const IntentClassificationSchema = z.enum([
  'RESEARCH',
  'INBOX',
  'PLANNING',
  'APPLICATION',
  'GENERAL',
  'DESKTOP',
]);

export const ApprovalRequestSchema = z.object({
  agentName: z.enum(['coordinator', 'research', 'inbox', 'planning', 'summary']),
  taskId: z.string().uuid(),
  message: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
});

export const ApprovalResponseSchema = z.object({
  requestId: z.string().uuid(),
  approved: z.boolean(),
  notes: z.string().optional(),
});

export const BrowserToolInputSchema = z.object({
  task: z.enum(['search', 'scrape', 'fill_form']),
  query: z.string().optional(),
  url: z.string().url().optional(),
  formData: z.record(z.unknown()).optional(),
});

export const GmailToolInputSchema = z.object({
  action: z.enum(['read', 'draft', 'send', 'list']),
  messageId: z.string().optional(),
  to: z.string().email().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  threadId: z.string().optional(),
});

export const CalendarToolInputSchema = z.object({
  action: z.enum(['list', 'create', 'update', 'delete']),
  eventId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export const ReceiptCreateSchema = z.object({
  sessionId: z.string().uuid(),
  receiptType: z.enum(['execution', 'payment', 'refund']),
  agentName: z.string(),
  taskId: z.string().uuid().optional(),
  inputHash: z.string(),
  outputHash: z.string(),
  executionTimeMs: z.number().optional(),
  costUnits: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});
