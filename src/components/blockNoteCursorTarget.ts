interface CursorTargetBlockLike {
  id: string
  content?: unknown
}

function blockSupportsTextCursor(block: CursorTargetBlockLike | undefined): block is CursorTargetBlockLike {
  return Array.isArray(block?.content)
}

export function findNearestTextCursorBlock(
  blocks: CursorTargetBlockLike[],
  targetIndex: number,
): CursorTargetBlockLike | null {
  if (blocks.length === 0) return null

  const clampedTargetIndex = Math.min(Math.max(targetIndex, 0), blocks.length - 1)
  const targetBlock = blocks[clampedTargetIndex]
  if (blockSupportsTextCursor(targetBlock)) {
    return targetBlock
  }

  for (let distance = 1; distance < blocks.length; distance += 1) {
    const forwardBlock = blocks[clampedTargetIndex + distance]
    if (blockSupportsTextCursor(forwardBlock)) {
      return forwardBlock
    }

    const backwardBlock = blocks[clampedTargetIndex - distance]
    if (blockSupportsTextCursor(backwardBlock)) {
      return backwardBlock
    }
  }

  return null
}

export function findNearestTextCursorBlockById(
  blocks: CursorTargetBlockLike[],
  targetBlockId: string,
): CursorTargetBlockLike | null {
  const targetIndex = blocks.findIndex((block) => block.id === targetBlockId)
  if (targetIndex === -1) return null

  return findNearestTextCursorBlock(blocks, targetIndex)
}
