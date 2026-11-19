import type { Access } from '../access.ts'
import type { Services } from '../routes.ts'

/** What a tool runs with: the server's services and the access of the request that called it. */
export interface ToolContext {
  services: Services
  access: Access
}

/** Arguments after they were checked against the tool's input schema. */
export type ToolArgs = Readonly<Record<string, string | number>>

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: true
}

export type ToolHandler = (args: ToolArgs, context: ToolContext) => Promise<ToolResult>

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

export function jsonResult(value: unknown): ToolResult {
  return textResult(JSON.stringify(value, null, 2))
}

/** A failure the agent can act on: reported in the result, not as a protocol error. */
export function errorResult(text: string): ToolResult {
  return { ...textResult(`Error: ${text}`), isError: true }
}

/** A string argument; '' when it was left out. */
export function stringArg(args: ToolArgs, name: string): string {
  const value = args[name]
  return typeof value === 'string' ? value : ''
}

/** A number argument, or undefined when it was left out. */
export function numberArg(args: ToolArgs, name: string): number | undefined {
  const value = args[name]
  return typeof value === 'number' ? value : undefined
}
