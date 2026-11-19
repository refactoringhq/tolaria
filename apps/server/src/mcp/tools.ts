import { VaultError } from '../errors.ts'
import { INVALID_PARAMS, RpcError, type RpcParams } from './jsonRpc.ts'
import { READ_TOOLS } from './readTools.ts'
import { errorResult, type ToolArgs, type ToolContext, type ToolHandler, type ToolResult } from './results.ts'
import { type ArgumentType, TOOL_DEFINITIONS, type ToolDefinition } from './toolDefinitions.ts'
import { WRITE_TOOLS } from './writeTools.ts'

const HANDLERS = new Map<string, ToolHandler>([...READ_TOOLS, ...WRITE_TOOLS])

function invalidParams(message: string): RpcError {
  return new RpcError(INVALID_PARAMS, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value instanceof Object && !Array.isArray(value)
}

function toolNamed(name: unknown): { definition: ToolDefinition; handler: ToolHandler } {
  const definition = TOOL_DEFINITIONS.find((tool) => tool.name === name)
  const handler = typeof name === 'string' ? HANDLERS.get(name) : undefined
  if (!definition || !handler) throw invalidParams(`unknown tool: ${String(name)}`)
  return { definition, handler }
}

function typed(value: unknown, type: ArgumentType): string | number | null {
  if (type === 'string') return typeof value === 'string' ? value : null
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function given(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {}
  if (isRecord(raw)) return raw
  throw invalidParams('arguments must be an object')
}

/**
 * The arguments the tool's schema names, each of its declared type; required ones present.
 * Arguments it does not name (such as the desktop's `vaultPath`) are ignored.
 */
function checkedArguments({ inputSchema }: ToolDefinition, raw: unknown): ToolArgs {
  const args = given(raw)
  const missing = (inputSchema.required ?? []).find((name) => args[name] === undefined || args[name] === null)
  if (missing) throw invalidParams(`${missing} is required`)
  const checked: Record<string, string | number> = {}
  for (const [name, { type }] of Object.entries(inputSchema.properties)) {
    const value = args[name]
    if (value === undefined || value === null) continue
    const checkedValue = typed(value, type)
    if (checkedValue === null) throw invalidParams(`${name} must be a ${type}`)
    checked[name] = checkedValue
  }
  return checked
}

/**
 * Runs `tools/call`. Bad arguments are protocol errors; a refusal of the vault (access, path,
 * stale revision) is a result with `isError`, as the desktop server reports it.
 */
export async function callTool(params: RpcParams, context: ToolContext): Promise<ToolResult> {
  const { definition, handler } = toolNamed(params.name)
  const args = checkedArguments(definition, params.arguments)
  try {
    return await handler(args, context)
  } catch (error) {
    if (error instanceof VaultError) return errorResult(error.message)
    throw error
  }
}
