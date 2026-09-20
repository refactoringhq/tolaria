import { Fragment, type Node as ProsemirrorNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

interface RepairableProsemirrorView {
  dispatch: (transaction: Transaction) => unknown
  state: {
    doc: ProsemirrorNode
    tr: Transaction
  }
}

interface RepairedProsemirrorNode {
  changed: boolean
  node: ProsemirrorNode
}

function isBlockContentNode(node: ProsemirrorNode): boolean {
  return node.type.spec.group?.split(' ').includes('blockContent') === true
}

function repairMalformedProsemirrorNode(node: ProsemirrorNode): RepairedProsemirrorNode {
  let changed = false
  const children: ProsemirrorNode[] = []

  node.forEach((child) => {
    const repairedChild = repairMalformedProsemirrorNode(child)
    changed ||= repairedChild.changed
    children.push(repairedChild.node)
  })

  if (node.type.name === 'blockContainer' && !children.some(isBlockContentNode)) {
    const paragraph = node.type.schema.nodes.paragraph
    if (paragraph) {
      children.unshift(paragraph.create())
      changed = true
    }
  }

  return {
    changed,
    node: changed ? node.copy(Fragment.from(children)) : node,
  }
}

export function repairMalformedBlockContainers(view: unknown): void {
  const repairableView = view as RepairableProsemirrorView
  const doc = repairableView.state?.doc
  const transaction = repairableView.state?.tr
  if (!doc || !transaction) return

  const repaired = repairMalformedProsemirrorNode(doc)
  if (!repaired.changed) return

  repairableView.dispatch(transaction.replaceWith(0, doc.content.size, repaired.node.content))
}
