import type { MobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import type { NativeTableOfContentsProof } from '../../qa/nativeTableOfContentsProbe'
import type { MobileTableOfContentsTarget } from '../../workspace/mobileTableOfContents'
import type { MobileTypeDefinitions } from '../../workspace/mobileWorkspaceModel'
import { MobileMarkdownSourceEditor, type MobileMarkdownSourceEditorProps } from './MobileMarkdownSourceEditor'

type MobileWysiwygMarkdownEditorProps = MobileMarkdownSourceEditorProps & {
  layoutProbe?: MobileLayoutProbe
  onNavigateWikilink?: (target: string) => void
  onOpenLink?: (href: string) => void
  onTableOfContentsScrollProof?: (proof: NativeTableOfContentsProof) => void
  tableOfContentsTarget?: MobileTableOfContentsTarget | null
  wysiwygAutocompleteProbe?: boolean
  wysiwygExternalLinkProbe?: boolean
  wysiwygFormatCommandProbe?: boolean
  wysiwygInputTransformProbe?: boolean
  wysiwygMarkdownBlockProbe?: boolean
  wysiwygMathEditProbe?: boolean
  wysiwygTableCommandMutationProbe?: boolean
  wysiwygWikilinkInsertProbe?: boolean
  wysiwygMutationProbe?: boolean
  vaultRootUri?: string | null
  typeDefinitions?: MobileTypeDefinitions
}

export function MobileWysiwygMarkdownEditor(props: MobileWysiwygMarkdownEditorProps) {
  const {
    layoutProbe,
    onNavigateWikilink,
    onOpenLink,
    onTableOfContentsScrollProof,
    tableOfContentsTarget,
    wysiwygAutocompleteProbe,
    wysiwygExternalLinkProbe,
    wysiwygFormatCommandProbe,
    wysiwygInputTransformProbe,
    wysiwygMarkdownBlockProbe,
    wysiwygMathEditProbe,
    wysiwygTableCommandMutationProbe,
    wysiwygWikilinkInsertProbe,
    wysiwygMutationProbe,
    vaultRootUri,
    typeDefinitions,
    ...sourceEditorProps
  } = props
  void layoutProbe
  void onNavigateWikilink
  void onOpenLink
  void onTableOfContentsScrollProof
  void tableOfContentsTarget
  void wysiwygAutocompleteProbe
  void wysiwygExternalLinkProbe
  void wysiwygFormatCommandProbe
  void wysiwygInputTransformProbe
  void wysiwygMarkdownBlockProbe
  void wysiwygMathEditProbe
  void wysiwygTableCommandMutationProbe
  void wysiwygWikilinkInsertProbe
  void wysiwygMutationProbe
  void vaultRootUri
  void typeDefinitions
  return <MobileMarkdownSourceEditor {...sourceEditorProps} />
}
