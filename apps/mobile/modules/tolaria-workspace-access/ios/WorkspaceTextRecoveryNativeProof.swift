#if DEBUG
import Foundation

private enum TextRecoveryProbeFailure: Error { case interrupted, didNotInterrupt, invalidPhase }

func runWorkspaceTextRecoveryNativeProof(_ phase: String) throws -> [String: Any] {
  let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
  let root = cache.appendingPathComponent("TolariaTextRecoveryQA")
  let writer = try managedWorkspaceText(root.absoluteString)
  switch phase {
  case "prepare", "prepare-conflict":
    try prepareTextRecoveryProof(writer, conflict: phase == "prepare-conflict")
  case "inspect": break
  case "cleanup":
    try clearTextRecoveryProof(writer)
    return ["cleaned": true]
  default: throw TextRecoveryProbeFailure.invalidPhase
  }
  return [
    "rootUri": root.absoluteString,
    "content": try String(contentsOf: root.appendingPathComponent("note.md"), encoding: .utf8),
    "pending": FileManager.default.fileExists(atPath: writer.journal.path),
    "privateJournal": !writer.journal.path.hasPrefix(root.path + "/"),
  ]
}

private func prepareTextRecoveryProof(_ writer: WorkspaceTextRecovery, conflict: Bool) throws {
  try clearTextRecoveryProof(writer)
  try FileManager.default.createDirectory(at: writer.root, withIntermediateDirectories: true)
  let destination = writer.root.appendingPathComponent("note.md")
  try Data("# Before\n".utf8).write(to: destination, options: .atomic)
  var interrupted = writer
  interrupted.afterStage = { stage in
    if stage == .published { throw TextRecoveryProbeFailure.interrupted }
  }
  do {
    try interrupted.write("note.md", content: "---\ncustom: retained\n---\n# Recovered\n")
    throw TextRecoveryProbeFailure.didNotInterrupt
  } catch TextRecoveryProbeFailure.interrupted { /* Simulate termination after journal publication. */ }
  if conflict { try Data("# External edit\n".utf8).write(to: destination, options: .atomic) }
}

private func clearTextRecoveryProof(_ writer: WorkspaceTextRecovery) throws {
  for url in [writer.journal, writer.root] {
    if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
  }
}
#endif
