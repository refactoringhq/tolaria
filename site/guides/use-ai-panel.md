# Use The AI

Tolaria gives you two ways to ask for AI help: open the AI panel for an ongoing conversation, or prompt directly from the editor with `Cmd+K` followed by a space.

## Choose How To Prompt

- **AI panel** is best for longer conversations, agent work, and requests that need visible back-and-forth.
- **Inline prompt** is best when you are already writing. Press `Cmd+K`, type a space, then write the prompt you want the AI to handle from the current note context.

## Choose A Target

Open Settings and choose the default AI target:

- **Coding agent** for tool-backed vault editing through Claude Code, Codex, GitHub Copilot, OpenCode, Pi, Antigravity CLI, Kiro, or Hermes Agent. Claude Code in the AI panel can use your configured Skills for specialized capabilities.
- **Local model** for Ollama or LM Studio chat over note context.
- **API model** for OpenAI, Anthropic, Gemini, OpenRouter, or an OpenAI-compatible endpoint.

If a coding agent is missing, install it and reopen Tolaria or switch to another target.

## Choose An Agent Model

Some coding agents expose a model picker in the AI workspace. Choose **Agent default** to let the CLI decide, or select one of the models reported by the installed agent.

Tolaria remembers the choice separately for each agent. If an agent removes a previously selected model, Tolaria falls back to **Agent default** instead of sending an obsolete model ID.

## Permission Mode

Coding agents support per-vault permission modes:

- **Vault Safe** keeps agents limited to file, search, and edit tools.
- **Power User** can allow shell commands for agents that support them.

Direct model targets always stay in chat mode. They can use note context, but they cannot edit vault files through tools.

## Good Requests

- "Find notes related to this project."
- "Summarize what changed in this note."
- "Draft a weekly review from these linked notes."
- "Update this checklist based on the current project status."

## Review Changes

AI edits are file edits. Review them with Tolaria's diff and Git history before committing.

Use the stop control when a request is no longer useful or an agent is taking the wrong direction. Stopping ends the active stream without changing the target for your next request.
