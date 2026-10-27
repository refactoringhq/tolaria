import ExpoModulesCore
import UIKit

private let keyboardProbeLogPrefix = "TOLARIA_MOBILE_KEYBOARD_SHORTCUT_PROBE"
private let keyboardProbeEnvironmentName = "TOLARIA_MOBILE_KEYBOARD_SHORTCUT_PROBE"
private let mobileSearchEnvironmentName = "TOLARIA_MOBILE_SEARCH"

private struct TolariaKeyCommand {
  let action: String
  let code: String
  let input: String
  let key: String
  let modifierFlags: UIKeyModifierFlags

  var altKey: Bool { modifierFlags.contains(.alternate) }
  var ctrlKey: Bool { modifierFlags.contains(.control) }
  var metaKey: Bool { modifierFlags.contains(.command) }
  var shiftKey: Bool { modifierFlags.contains(.shift) }

  init(_ action: String, key: String, code: String, input: String? = nil, modifiers: UIKeyModifierFlags = .command) {
    self.action = action
    self.key = key
    self.code = code
    self.input = input ?? key
    self.modifierFlags = modifiers
  }
}

public struct TolariaApplicationKeyCommand {
  public let input: String
  public let modifierFlags: UIKeyModifierFlags
}

public class TolariaKeyCommandsModule: Module {
  private static weak var activeModule: TolariaKeyCommandsModule?
  private static var paletteOpen = false
  private static var modalOpen = false
  public static var commandPaletteOpen: Bool { paletteOpen }
  public static var dismissibleModalOpen: Bool { modalOpen }
  private static let commands: [TolariaKeyCommand] = [
    TolariaKeyCommand("commandPalette", key: "k", code: "KeyK"),
    TolariaKeyCommand("findInNote", key: "f", code: "KeyF"),
    TolariaKeyCommand("search", key: "o", code: "KeyO"),
    TolariaKeyCommand("search", key: "p", code: "KeyP"),
    TolariaKeyCommand("toggleRawEditor", key: "\\", code: "Backslash"),
    TolariaKeyCommand("createNote", key: "n", code: "KeyN"),
    TolariaKeyCommand("viewEditorOnly", key: "1", code: "Digit1"),
    TolariaKeyCommand("viewEditorList", key: "2", code: "Digit2"),
    TolariaKeyCommand("viewAll", key: "3", code: "Digit3"),
    TolariaKeyCommand("toggleProperties", key: "i", code: "KeyI", modifiers: [.command, .shift]),
    TolariaKeyCommand("dismissModal", key: "Escape", code: "Escape", input: UIKeyCommand.inputEscape, modifiers: []),
    TolariaKeyCommand(
      "previousNote",
      key: "ArrowUp",
      code: "ArrowUp",
      input: UIKeyCommand.inputUpArrow,
      modifiers: []
    ),
    TolariaKeyCommand(
      "nextNote",
      key: "ArrowDown",
      code: "ArrowDown",
      input: UIKeyCommand.inputDownArrow,
      modifiers: []
    )
  ]

  public func definition() -> ModuleDefinition {
    Name("TolariaKeyCommands")

    Events("onShortcut")

    Function("isSupported") {
      return true
    }

    AsyncFunction("setCommandPaletteOpen") { (open: Bool) in
      Self.paletteOpen = open
    }.runOnQueue(.main)

    AsyncFunction("setModalOpen") { (open: Bool) in
      Self.modalOpen = open
      self.logKeyboardProbe(["kind": "modal", "open": open])
    }.runOnQueue(.main)

    Function("launchArguments") {
      return ProcessInfo.processInfo.arguments
    }

    Function("environmentValue") { (name: String) -> String? in
      return ProcessInfo.processInfo.environment[name]
    }

    OnStartObserving("onShortcut") {
      Self.activeModule = self
      var proof: [String: Any] = [
        "kind": "bridge",
        "nativeModuleAvailable": true
      ]
      if let qaRun = self.keyboardProbeRun() {
        proof["qaRun"] = qaRun
      }
      self.logKeyboardProbe(proof)
    }

    OnStopObserving("onShortcut") {
      if Self.activeModule === self {
        Self.activeModule = nil
        Self.paletteOpen = false
        Self.modalOpen = false
      }
    }
  }

  public static func applicationKeyCommands() -> [TolariaApplicationKeyCommand] {
    return commands.map {
      TolariaApplicationKeyCommand(input: $0.input, modifierFlags: $0.modifierFlags)
    }
  }

  public static func dispatchApplicationKeyCommand(
    input: String?,
    modifierFlags: UIKeyModifierFlags
  ) {
    guard let input else { return }
    guard let command = commands.first(where: {
      $0.input == input && $0.modifierFlags == modifierFlags
    }) else { return }
    activeModule?.sendShortcut(command)
  }

  private func sendShortcut(_ command: TolariaKeyCommand) {
    logKeyboardProbe([
      "action": command.action,
      "altKey": command.altKey,
      "code": command.code,
      "ctrlKey": command.ctrlKey,
      "kind": "action",
      "key": command.key,
      "metaKey": command.metaKey,
      "shiftKey": command.shiftKey,
      "source": "native"
    ])
    sendEvent("onShortcut", [
      "action": command.action,
      "altKey": command.altKey,
      "code": command.code,
      "ctrlKey": command.ctrlKey,
      "key": command.key,
      "metaKey": command.metaKey,
      "shiftKey": command.shiftKey,
      "source": "native"
    ])
  }

  private func logKeyboardProbe(_ proof: [String: Any]) {
    guard keyboardProbeLoggingEnabled() else { return }

    guard
      let data = try? JSONSerialization.data(withJSONObject: proof),
      let json = String(data: data, encoding: .utf8)
    else {
      return
    }

    NSLog("%@ %@", keyboardProbeLogPrefix, json)
  }

  private func keyboardProbeLoggingEnabled() -> Bool {
    let environment = ProcessInfo.processInfo.environment

    return environment[keyboardProbeEnvironmentName] == "1"
      || environment[mobileSearchEnvironmentName]?.contains("mobileKeyboardShortcutProbe=1") == true
  }

  private func keyboardProbeRun() -> String? {
    guard let search = ProcessInfo.processInfo.environment[mobileSearchEnvironmentName] else { return nil }
    return URLComponents(string: "tolaria://qa?\(search)")?
      .queryItems?
      .first(where: { $0.name == "qaRun" })?
      .value
  }
}

public final class TolariaKeyCommandsReactDelegateHandler: ExpoReactDelegateHandler {
  public override func createRootViewController() -> UIViewController? {
    return TolariaKeyCommandsRootViewController()
  }
}

private final class TolariaKeyCommandsRootViewController: UIViewController {
  override var canBecomeFirstResponder: Bool { true }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if !containsFocusedTextInput(view.window ?? view) { becomeFirstResponder() }
  }

  override var keyCommands: [UIKeyCommand]? {
    let textInputFocused = containsFocusedTextInput(view.window ?? view)
    return TolariaKeyCommandsModule.applicationKeyCommands().filter {
      if $0.input == UIKeyCommand.inputEscape { return TolariaKeyCommandsModule.dismissibleModalOpen }
      return !$0.modifierFlags.isEmpty || !textInputFocused || TolariaKeyCommandsModule.commandPaletteOpen
    }.map { specification in
      let command = UIKeyCommand(
        input: specification.input,
        modifierFlags: specification.modifierFlags,
        action: #selector(handleTolariaKeyCommand(_:))
      )
      command.wantsPriorityOverSystemBehavior = true
      return command
    }
  }

  private func containsFocusedTextInput(_ candidate: UIView) -> Bool {
    if candidate.isFirstResponder && candidate is UITextInput { return true }
    return candidate.subviews.contains(where: containsFocusedTextInput)
  }

  @objc private func handleTolariaKeyCommand(_ command: UIKeyCommand) {
    TolariaKeyCommandsModule.dispatchApplicationKeyCommand(
      input: command.input,
      modifierFlags: command.modifierFlags
    )
  }
}
