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

    AsyncFunction("importWorkspace") { (uri: String) throws -> [String: String]? in
      return try self.importWorkspace(uri)
    }

    AsyncFunction("pickAndImportWorkspace") { (promise: Promise) in
      self.presentWorkspacePicker(promise)
    }.runOnQueue(.main)

    AsyncFunction("restoreWorkspace") { () throws -> [String: String]? in
      return try self.restoreWorkspace()
    }

    #if DEBUG
    AsyncFunction("runFileAccessProbe") { () throws -> [String: Bool] in
      return try runWorkspaceFileNativeProof()
    }
    #endif
  }

  private func importWorkspace(_ uri: String) throws -> [String: String]? {
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

    return try copyWorkspace(from: source)
  }

  private func copyWorkspace(from source: URL) throws -> [String: String] {
    let label = source.deletingPathExtension().lastPathComponent
    guard !label.isEmpty else { throw WorkspaceFileError.invalidPath }

    let managed = try managedWorkspaceURL()
    let indexJson = try importManagedWorkspace(from: source, to: managed)
    UserDefaults.standard.set(label, forKey: managedWorkspaceLabelKey)
    return ["indexJson": indexJson, "label": label, "uri": managed.absoluteString]
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
      promise.reject(CocoaError(.fileReadNoPermission))
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      defer { if usesSecurityScope { source.stopAccessingSecurityScopedResource() } }
      do {
        promise.resolve(try self.copyWorkspace(from: source))
      } catch {
        promise.reject(error)
      }
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

  private func restoreWorkspace() throws -> [String: String]? {
    guard let label = UserDefaults.standard.string(forKey: managedWorkspaceLabelKey) else {
      return nil
    }
    let managed = try managedWorkspaceURL()
    return try workspaceRecord(root: managed, label: label)
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

  private func workspaceRecord(root: URL, label: String) throws -> [String: String] {
    return [
      "indexJson": try WorkspaceFileIndex(root: root).json(),
      "label": label,
      "uri": root.absoluteString,
    ]
  }
}
