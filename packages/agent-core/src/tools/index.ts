import { Tool } from '@langchain/core/tools';
import { z } from 'zod';

export interface BaseToolInput {
  sessionId: string;
  requestId: string;
}

export interface BaseToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  executionTimeMs: number;
}

export abstract class BaseSolliTool extends Tool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodType;

  abstract execute(input: Record<string, unknown>): Promise<BaseToolResult>;
}

export function createToolDescription(
  _name: string,
  description: string,
  parameters: Record<string, string>
): string {
  const paramList = Object.entries(parameters)
    .map(([key, value]) => `  - ${key}: ${value}`)
    .join('\n');

  return `${description}\n\nParameters:\n${paramList}`;
}

export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): T {
  return schema.parse(input);
}
