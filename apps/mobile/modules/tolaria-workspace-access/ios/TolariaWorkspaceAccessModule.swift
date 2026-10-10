import ExpoModulesCore
import Foundation
import UIKit
import UniformTypeIdentifiers

private let managedWorkspaceDirectoryName = "Tolaria Vault"
private let managedWorkspaceLabelKey = "tolaria.workspace.label"

private final class WorkspacePickerDelegate: NSObject, UIDocumentPickerDelegate,
  UIAdaptivePresentationControllerDelegate {
  private let onCancel: () -> Void
  private let onPick: (URL) -> Void

  init(onCancel: @escaping () -> Void, onPick: @escaping (URL) -> Void) {
    self.onCancel = onCancel
    self.onPick = onPick
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let source = urls.first else {
      onCancel()
      return
    }
    onPick(source)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    onCancel()
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    onCancel()
  }
}

private struct WorkspacePickerContext {
  let delegate: WorkspacePickerDelegate
  let promise: Promise
}

public class TolariaWorkspaceAccessModule: Module {
  private var pickerContext: WorkspacePickerContext?

  public func definition() -> ModuleDefinition {
    Name("TolariaWorkspaceAccess")

    AsyncFunction("importWorkspace") { (uri: String) -> [String: String]? in
      return self.importWorkspace(uri)
    }

    AsyncFunction("pickAndImportWorkspace") { (promise: Promise) in
      self.presentWorkspacePicker(promise)
    }.runOnQueue(.main)

    AsyncFunction("restoreWorkspace") { () -> [String: String]? in
      return self.restoreWorkspace()
    }

    #if DEBUG
    AsyncFunction("runFileAccessProbe") { () throws -> [String: Bool] in
      return try runWorkspaceFileNativeProof()
    }
    #endif
  }

  private func importWorkspace(_ uri: String) -> [String: String]? {
    guard let source = URL(string: uri), source.isFileURL else { return nil }

    let usesSecurityScope = source.startAccessingSecurityScopedResource()
    defer {
      if usesSecurityScope {
        source.stopAccessingSecurityScopedResource()
      }
    }
    guard usesSecurityScope || FileManager.default.isReadableFile(atPath: source.path) else {
      return nil
    }

    return copyWorkspace(from: source)
  }

  private func copyWorkspace(from source: URL) -> [String: String]? {
    let label = source.deletingPathExtension().lastPathComponent
    guard !label.isEmpty else { return nil }

    do {
      let managed = try managedWorkspaceURL()
      if source.standardizedFileURL == managed.standardizedFileURL {
        UserDefaults.standard.set(label, forKey: managedWorkspaceLabelKey)
        return workspaceRecord(uri: managed.absoluteString, label: label)
      }
      let staging = managed.deletingLastPathComponent()
        .appendingPathComponent(".tolaria-import-\(UUID().uuidString)", isDirectory: true)
      defer { try? FileManager.default.removeItem(at: staging) }
      try FileManager.default.copyItem(at: source, to: staging)
      try replaceManagedWorkspace(at: managed, with: staging)
      UserDefaults.standard.set(label, forKey: managedWorkspaceLabelKey)
      return workspaceRecord(uri: managed.absoluteString, label: label)
    } catch {
      return nil
    }
  }

  private func presentWorkspacePicker(_ promise: Promise) {
    guard pickerContext == nil else {
      promise.resolve(nil)
      return
    }
    guard let currentViewController = appContext?.utilities?.currentViewController() else {
      promise.resolve(nil)
      return
    }

    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
    let delegate = WorkspacePickerDelegate(
      onCancel: { [weak self] in self?.cancelWorkspacePicker() },
      onPick: { [weak self] source in self?.importPickedWorkspace(source) }
    )
    picker.allowsMultipleSelection = false
    picker.delegate = delegate
    picker.presentationController?.delegate = delegate

    pickerContext = WorkspacePickerContext(delegate: delegate, promise: promise)
    currentViewController.present(picker, animated: true)
  }

  private func importPickedWorkspace(_ source: URL) {
    guard let promise = takePickerPromise() else { return }
    let usesSecurityScope = source.startAccessingSecurityScopedResource()
    guard usesSecurityScope || FileManager.default.isReadableFile(atPath: source.path) else {
      promise.resolve(nil)
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      let record = self.copyWorkspace(from: source)
      if usesSecurityScope {
        source.stopAccessingSecurityScopedResource()
      }
      promise.resolve(record)
    }
  }

  private func cancelWorkspacePicker() {
    takePickerPromise()?.resolve(nil)
  }

  private func takePickerPromise() -> Promise? {
    let promise = pickerContext?.promise
    pickerContext = nil
    return promise
  }

  private func restoreWorkspace() -> [String: String]? {
    guard let label = UserDefaults.standard.string(forKey: managedWorkspaceLabelKey) else {
      return nil
    }
    guard let managed = try? managedWorkspaceURL() else { return nil }
    guard FileManager.default.isReadableFile(atPath: managed.path) else { return nil }
    return workspaceRecord(uri: managed.absoluteString, label: label)
  }

  private func managedWorkspaceURL() throws -> URL {
    let documents = try FileManager.default.url(
      for: .documentDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    return documents.appendingPathComponent(managedWorkspaceDirectoryName, isDirectory: true)
  }

  private func replaceManagedWorkspace(at managed: URL, with staging: URL) throws {
    let fileManager = FileManager.default
    let backup = managed.deletingLastPathComponent()
      .appendingPathComponent(".tolaria-backup-\(UUID().uuidString)", isDirectory: true)
    let hadManagedWorkspace = fileManager.fileExists(atPath: managed.path)

    if hadManagedWorkspace {
      try fileManager.moveItem(at: managed, to: backup)
    }

    do {
      try fileManager.moveItem(at: staging, to: managed)
      if hadManagedWorkspace {
        try? fileManager.removeItem(at: backup)
      }
    } catch {
      try? fileManager.removeItem(at: staging)
      if hadManagedWorkspace {
        try? fileManager.moveItem(at: backup, to: managed)
      }
      throw error
    }
  }

  private func workspaceRecord(uri: String, label: String) -> [String: String] {
    let root = URL(string: uri)
    return [
      "indexJson": root.flatMap(workspaceIndexJson) ?? emptyWorkspaceIndexJson,
      "label": label,
      "uri": uri,
    ]
  }

  private func workspaceIndexJson(_ root: URL) -> String? {
    let keys: Set<URLResourceKey> = [
      .contentModificationDateKey,
      .creationDateKey,
      .fileSizeKey,
      .isDirectoryKey,
      .isRegularFileKey,
    ]
    guard let enumerator = FileManager.default.enumerator(
      at: root,
      includingPropertiesForKeys: Array(keys),
      options: [.skipsHiddenFiles, .skipsPackageDescendants]
    ) else { return emptyWorkspaceIndexJson }

    var directories: [String] = []
    var files: [[String: Any]] = []
    for case let url as URL in enumerator {
      appendWorkspaceEntry(
        url,
        root: root,
        keys: keys,
        enumerator: enumerator,
        directories: &directories,
        files: &files
      )
    }
    let index: [String: Any] = ["directories": directories, "files": files]
    guard let data = try? JSONSerialization.data(withJSONObject: index) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private func appendWorkspaceEntry(
    _ url: URL,
    root: URL,
    keys: Set<URLResourceKey>,
    enumerator: FileManager.DirectoryEnumerator,
    directories: inout [String],
    files: inout [[String: Any]]
  ) {
    guard let values = try? url.resourceValues(forKeys: keys) else { return }
    let relativePath = workspaceRelativePath(url, root: root)
    guard values.isDirectory != true else {
      appendWorkspaceDirectory(
        url,
        relativePath: relativePath,
        enumerator: enumerator,
        directories: &directories
      )
      return
    }
    guard values.isRegularFile == true, !relativePath.isEmpty else { return }
    files.append(workspaceFileRecord(url, relativePath: relativePath, values: values))
  }

  private func appendWorkspaceDirectory(
    _ url: URL,
    relativePath: String,
    enumerator: FileManager.DirectoryEnumerator,
    directories: inout [String]
  ) {
    guard url.lastPathComponent != "node_modules" else {
      enumerator.skipDescendants()
      return
    }
    guard !relativePath.isEmpty else { return }
    directories.append(relativePath)
  }

  private func workspaceFileRecord(
    _ url: URL,
    relativePath: String,
    values: URLResourceValues
  ) -> [String: Any] {
    let content = workspaceTextContent(url, relativePath: relativePath)
    return [
      "absolutePath": url.absoluteString,
      "content": content,
      "createdAt": milliseconds(values.creationDate),
      "modifiedAt": milliseconds(values.contentModificationDate),
      "relativePath": relativePath,
      "size": values.fileSize ?? content.utf8.count,
    ]
  }

  private func workspaceTextContent(_ url: URL, relativePath: String) -> String {
    guard isWorkspaceTextFile(relativePath) else { return "" }
    return (try? String(contentsOf: url, encoding: .utf8)) ?? ""
  }

  private func workspaceRelativePath(_ url: URL, root: URL) -> String {
    let rootPath = root.standardizedFileURL.path
    let path = url.standardizedFileURL.path
    guard path.hasPrefix(rootPath) else { return "" }
    return String(path.dropFirst(rootPath.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  }

  private func isWorkspaceTextFile(_ path: String) -> Bool {
    let url = URL(fileURLWithPath: path)
    let extensionName = url.pathExtension.lowercased()
    return workspaceTextExtensions.contains(extensionName)
      || workspaceTextFileNames.contains(url.lastPathComponent.lowercased())
  }

  private func milliseconds(_ date: Date?) -> Any {
    return date.map { $0.timeIntervalSince1970 * 1000 } ?? NSNull()
  }
}

private let emptyWorkspaceIndexJson = #"{"directories":[],"files":[]}"#

private let workspaceTextExtensions: Set<String> = [
  "bash", "bat", "c", "cfg", "clj", "cmd", "conf", "cpp", "css", "csv", "el", "erl",
  "ex", "exs", "fish", "go", "graphql", "h", "hcl", "hpp", "hs", "htm", "html", "ini",
  "java", "jl", "js", "json", "jsx", "kt", "less", "lisp", "lua", "md", "markdown", "mdx",
  "ml", "nix", "properties", "ps1", "py", "r", "rb", "rs", "scss", "sh", "sql", "svelte",
  "swift", "tf", "toml", "ts", "tsx", "txt", "vim", "vue", "xml", "yaml", "yml", "zig", "zsh",
]

private let workspaceTextFileNames: Set<String> = [
  ".editorconfig", ".env", ".gitignore", "brewfile", "dockerfile", "makefile",
]
