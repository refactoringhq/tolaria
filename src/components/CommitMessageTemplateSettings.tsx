import { useState } from 'react'
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SectionHeading, SettingsGroup, SettingsGroupItem } from './SettingsControls'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import {
  createCommitMessageTemplate,
  validateCommitMessageTemplate,
} from '../lib/commitMessageTemplates'
import { trackCommitTemplateChanged } from '../lib/productAnalytics'
import type { CommitMessageTemplate } from '../types'
import type { createTranslator } from '../lib/i18n'

type Translate = ReturnType<typeof createTranslator>

interface CommitMessageTemplateSettingsProps {
  templates: CommitMessageTemplate[]
  onTemplatesChange: (templates: CommitMessageTemplate[]) => void
  t: Translate
}

interface EditorState {
  mode: 'create' | 'edit'
  templateId: string | null
  name: string
  titleTemplate: string
  bodyTemplate: string
  nameError?: string
  titleError?: string
}

function emptyEditorState(): EditorState {
  return { mode: 'create', templateId: null, name: '', titleTemplate: '', bodyTemplate: '' }
}

function TemplateEditorDialog({
  editor,
  onEditorChange,
  onSave,
  onClose,
  t,
}: {
  editor: EditorState | null
  onEditorChange: (editor: EditorState) => void
  onSave: () => void
  onClose: () => void
  t: Translate
}) {
  if (!editor) return null

  const setField = (field: 'name' | 'titleTemplate' | 'bodyTemplate') => (value: string) => {
    onEditorChange({ ...editor, [field]: value })
  }

  return (
    <Dialog open={true} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[440px]" data-testid="commit-template-editor">
        <DialogHeader>
          <DialogTitle>
            {editor.mode === 'create'
              ? t('settings.commitTemplates.editor.createTitle')
              : t('settings.commitTemplates.editor.editTitle')}
          </DialogTitle>
          <DialogDescription>{t('settings.commitTemplates.variablesHelp')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="commit-template-name" className="text-sm font-medium">
              {t('settings.commitTemplates.nameLabel')}
            </label>
            <Input
              id="commit-template-name"
              value={editor.name}
              onChange={(event) => setField('name')(event.target.value)}
              placeholder={t('settings.commitTemplates.namePlaceholder')}
              aria-invalid={Boolean(editor.nameError)}
            />
            {editor.nameError && (
              <p className="text-xs text-destructive" role="alert">{editor.nameError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="commit-template-title" className="text-sm font-medium">
              {t('settings.commitTemplates.titleLabel')}
            </label>
            <Input
              id="commit-template-title"
              value={editor.titleTemplate}
              onChange={(event) => setField('titleTemplate')(event.target.value)}
              placeholder={t('settings.commitTemplates.titlePlaceholder')}
              aria-invalid={Boolean(editor.titleError)}
            />
            {editor.titleError && (
              <p className="text-xs text-destructive" role="alert">{editor.titleError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="commit-template-body" className="text-sm font-medium">
              {t('settings.commitTemplates.bodyLabel')}
            </label>
            <Textarea
              id="commit-template-body"
              value={editor.bodyTemplate}
              onChange={(event) => setField('bodyTemplate')(event.target.value)}
              placeholder={t('settings.commitTemplates.bodyPlaceholder')}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSave} data-testid="commit-template-editor-save">
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CommitMessageTemplateSettings({
  templates,
  onTemplatesChange,
  t,
}: CommitMessageTemplateSettingsProps) {
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommitMessageTemplate | null>(null)

  const openCreateEditor = () => setEditor(emptyEditorState())

  const openEditEditor = (template: CommitMessageTemplate) => {
    setEditor({
      mode: 'edit',
      templateId: template.id,
      name: template.name,
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
    })
  }

  const handleSave = () => {
    if (!editor) return
    const errors = validateCommitMessageTemplate(editor)
    if (errors.name || errors.titleTemplate) {
      setEditor({
        ...editor,
        nameError: errors.name ? t(errors.name) : undefined,
        titleError: errors.titleTemplate ? t(errors.titleTemplate) : undefined,
      })
      return
    }

    if (editor.mode === 'create') {
      const created = createCommitMessageTemplate({
        name: editor.name,
        titleTemplate: editor.titleTemplate,
        bodyTemplate: editor.bodyTemplate,
      })
      onTemplatesChange([...templates, created])
      trackCommitTemplateChanged({ action: 'created' })
    } else {
      onTemplatesChange(
        templates.map((template) =>
          template.id === editor.templateId
            ? {
              ...template,
              name: editor.name.trim(),
              titleTemplate: editor.titleTemplate.trim(),
              bodyTemplate: editor.bodyTemplate.trim(),
            }
            : template,
        ),
      )
      trackCommitTemplateChanged({ action: 'updated' })
    }
    setEditor(null)
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    onTemplatesChange(templates.filter((template) => template.id !== deleteTarget.id))
    trackCommitTemplateChanged({ action: 'deleted' })
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-3">
      <SectionHeading title={t('settings.commitTemplates.title')} />
      <p className="text-xs leading-5 text-muted-foreground">{t('settings.commitTemplates.description')}</p>
      <SettingsGroup>
        {templates.length === 0 ? (
          <SettingsGroupItem testId="commit-templates-empty">
            <p className="text-sm text-muted-foreground">{t('settings.commitTemplates.empty')}</p>
          </SettingsGroupItem>
        ) : (
          templates.map((template) => (
            <SettingsGroupItem key={template.id} testId={`commit-template-row-${template.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="truncate text-sm font-medium text-foreground">{template.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{template.titleTemplate}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('settings.commitTemplates.edit')}
                    title={t('settings.commitTemplates.edit')}
                    onClick={() => openEditEditor(template)}
                    data-testid={`commit-template-edit-${template.id}`}
                  >
                    <PencilSimple size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('settings.commitTemplates.delete')}
                    title={t('settings.commitTemplates.delete')}
                    onClick={() => setDeleteTarget(template)}
                    data-testid={`commit-template-delete-${template.id}`}
                  >
                    <Trash size={15} />
                  </Button>
                </div>
              </div>
            </SettingsGroupItem>
          ))
        )}
      </SettingsGroup>
      <div>
        <Button type="button" variant="outline" onClick={openCreateEditor} data-testid="commit-template-add">
          <Plus size={15} className="shrink-0" />
          {t('settings.commitTemplates.add')}
        </Button>
      </div>
      <TemplateEditorDialog
        editor={editor}
        onEditorChange={setEditor}
        onSave={handleSave}
        onClose={() => setEditor(null)}
        t={t}
      />
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={t('settings.commitTemplates.deleteTitle')}
        message={deleteTarget ? t('settings.commitTemplates.deleteMessage', { name: deleteTarget.name }) : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
