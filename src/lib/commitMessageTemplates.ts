import type { CommitMessageTemplate } from '../types'
import type { TranslationKey } from './i18n'

export type { CommitMessageTemplate }

export interface TemplateVariableContext {
  date: string
  branch: string
  vault: string
}

export type CommitMessageTemplateErrors = Partial<
  Pick<CommitMessageTemplate, 'name' | 'titleTemplate' | 'bodyTemplate'>
>

const TEMPLATE_VARIABLE_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g

let fallbackTemplateIdCounter = 0

function randomTemplateIdPart(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID().slice(0, 8)

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const values = new Uint32Array(2)
    cryptoApi.getRandomValues(values)
    return Array.from(values, (value) => value.toString(36)).join('').slice(0, 8)
  }

  fallbackTemplateIdCounter += 1
  return fallbackTemplateIdCounter.toString(36).padStart(4, '0')
}

export function nextCommitMessageTemplateId(): string {
  return `commit-template-${Date.now()}-${randomTemplateIdPart()}`
}

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeCommitMessageTemplate(value: unknown): CommitMessageTemplate | null {
  if (!isRecord(value)) return null
  const id = trimmedString(value.id)
  const name = trimmedString(value.name)
  const titleTemplate = trimmedString(value.titleTemplate)
  if (!id || !name || !titleTemplate) return null
  return {
    id,
    name,
    titleTemplate,
    bodyTemplate: trimmedString(value.bodyTemplate),
  }
}

export function normalizeCommitMessageTemplates(value: unknown): CommitMessageTemplate[] {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizeCommitMessageTemplate)
    .filter((template): template is CommitMessageTemplate => template !== null)
}

export function createCommitMessageTemplate(input: {
  name: string
  titleTemplate: string
  bodyTemplate?: string
}): CommitMessageTemplate {
  return {
    id: nextCommitMessageTemplateId(),
    name: input.name.trim(),
    titleTemplate: input.titleTemplate.trim(),
    bodyTemplate: input.bodyTemplate?.trim() ?? '',
  }
}

export function validateCommitMessageTemplate(input: {
  name: string
  titleTemplate: string
  bodyTemplate?: string
}): Record<'name' | 'titleTemplate', TranslationKey | undefined> {
  return {
    name: input.name.trim() ? undefined : 'settings.commitTemplates.validation.nameRequired',
    titleTemplate: input.titleTemplate.trim()
      ? undefined
      : 'settings.commitTemplates.validation.titleRequired',
  }
}

const TEMPLATE_VARIABLE_LOOKUP: Record<keyof TemplateVariableContext, true> = {
  date: true,
  branch: true,
  vault: true,
}

/**
 * Replaces supported template variables such as {date}, {branch}, and {vault}.
 * Unknown variables are preserved verbatim so a typo can never break a push.
 */
export function renderTemplateVariables(template: string, context: TemplateVariableContext): string {
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (match, variableName: string) => {
    if (TEMPLATE_VARIABLE_LOOKUP[variableName as keyof TemplateVariableContext]) {
      return context[variableName as keyof TemplateVariableContext] ?? ''
    }
    return match
  })
}

export function applyTemplateToMessage(
  template: CommitMessageTemplate,
  context: TemplateVariableContext,
): { title: string; body: string } {
  return {
    title: renderTemplateVariables(template.titleTemplate, context),
    body: renderTemplateVariables(template.bodyTemplate, context),
  }
}

export const DEFAULT_COMMIT_MESSAGE_TEMPLATE: CommitMessageTemplate = {
  id: 'default',
  name: 'Default',
  titleTemplate: 'docs({vault}): update {date}',
  bodyTemplate: 'Synced {vault} from branch {branch} on {date}.',
}

export function getAvailableTemplates(
  customTemplates: CommitMessageTemplate[],
): CommitMessageTemplate[] {
  return [...customTemplates, DEFAULT_COMMIT_MESSAGE_TEMPLATE]
}

export function isDefaultCommitMessageTemplate(template: CommitMessageTemplate): boolean {
  return template.id === DEFAULT_COMMIT_MESSAGE_TEMPLATE.id
}

export function splitCommitMessage(message: string): { title: string; body: string } {
  const lines = message.split('\n')
  const title = (lines.shift() ?? '').trim()
  return { title, body: lines.join('\n').trim() }
}

export function joinCommitMessage(title: string, body: string): string {
  const trimmedTitle = title.trim()
  const trimmedBody = body.trim()
  return trimmedBody ? `${trimmedTitle}\n\n${trimmedBody}` : trimmedTitle
}
