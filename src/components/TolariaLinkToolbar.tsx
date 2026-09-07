import { ArrowSquareOut as ExternalLink } from '@phosphor-icons/react'
import { useCallback } from 'react'
import {
  DeleteLinkButton,
  EditLinkButton,
  LinkToolbar,
  useComponentsContext,
  useDictionary,
  type LinkToolbarProps,
} from '@blocknote/react'
import { openEditorAttachmentOrUrl } from './editorAttachmentActions'

function useRequiredComponentsContext() {
  const components = useComponentsContext()
  if (!components) throw new Error('BlockNote components context is unavailable')
  return components
}

function TolariaOpenLinkButton({ url, vaultPath }: Pick<LinkToolbarProps, 'url'> & { vaultPath?: string }) {
  const Components = useRequiredComponentsContext()
  const dict = useDictionary()
  const handleOpen = useCallback(() => {
    openEditorAttachmentOrUrl({ url, vaultPath, source: 'link' })
  }, [url, vaultPath])

  return (
    <Components.LinkToolbar.Button
      className="bn-button"
      label={dict.link_toolbar.open.tooltip}
      mainTooltip={dict.link_toolbar.open.tooltip}
      isSelected={false}
      onClick={handleOpen}
      icon={<ExternalLink size={16} />}
    />
  )
}

export function TolariaLinkToolbar({ vaultPath, ...props }: LinkToolbarProps & { vaultPath?: string }) {
  return (
    <LinkToolbar {...props}>
      <EditLinkButton
        url={props.url}
        text={props.text}
        range={props.range}
        setToolbarOpen={props.setToolbarOpen}
        setToolbarPositionFrozen={props.setToolbarPositionFrozen}
      />
      <TolariaOpenLinkButton url={props.url} vaultPath={vaultPath} />
      <DeleteLinkButton range={props.range} setToolbarOpen={props.setToolbarOpen} />
    </LinkToolbar>
  )
}
