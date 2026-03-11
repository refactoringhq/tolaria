/// Content for the built-in default (light) theme.
pub const DEFAULT_THEME: &str = r##"{
  "name": "Default",
  "description": "Light theme with warm, paper-like tones",
  "colors": {
    "background": "#FFFFFF",
    "foreground": "#37352F",
    "card": "#FFFFFF",
    "popover": "#FFFFFF",
    "primary": "#155DFF",
    "primary-foreground": "#FFFFFF",
    "secondary": "#EBEBEA",
    "secondary-foreground": "#37352F",
    "muted": "#F0F0EF",
    "muted-foreground": "#787774",
    "accent": "#EBEBEA",
    "accent-foreground": "#37352F",
    "destructive": "#E03E3E",
    "border": "#E9E9E7",
    "input": "#E9E9E7",
    "ring": "#155DFF",
    "sidebar-background": "#F7F6F3",
    "sidebar-foreground": "#37352F",
    "sidebar-border": "#E9E9E7",
    "sidebar-accent": "#EBEBEA"
  },
  "typography": {
    "font-family": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    "font-size-base": "14px"
  },
  "spacing": {
    "sidebar-width": "250px"
  }
}"##;

/// Content for the built-in dark theme.
pub const DARK_THEME: &str = r##"{
  "name": "Dark",
  "description": "Dark variant with deep navy tones",
  "colors": {
    "background": "#0f0f1a",
    "foreground": "#e0e0e0",
    "card": "#16162a",
    "popover": "#1e1e3a",
    "primary": "#155DFF",
    "primary-foreground": "#FFFFFF",
    "secondary": "#2a2a4a",
    "secondary-foreground": "#e0e0e0",
    "muted": "#1e1e3a",
    "muted-foreground": "#888888",
    "accent": "#2a2a4a",
    "accent-foreground": "#e0e0e0",
    "destructive": "#f44336",
    "border": "#2a2a4a",
    "input": "#2a2a4a",
    "ring": "#155DFF",
    "sidebar-background": "#1a1a2e",
    "sidebar-foreground": "#e0e0e0",
    "sidebar-border": "#2a2a4a",
    "sidebar-accent": "#2a2a4a"
  },
  "typography": {
    "font-family": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    "font-size-base": "14px"
  },
  "spacing": {
    "sidebar-width": "250px"
  }
}"##;

/// Content for the built-in minimal theme.
pub const MINIMAL_THEME: &str = r##"{
  "name": "Minimal",
  "description": "High contrast, minimal chrome",
  "colors": {
    "background": "#FAFAFA",
    "foreground": "#111111",
    "card": "#FFFFFF",
    "popover": "#FFFFFF",
    "primary": "#000000",
    "primary-foreground": "#FFFFFF",
    "secondary": "#F0F0F0",
    "secondary-foreground": "#111111",
    "muted": "#F5F5F5",
    "muted-foreground": "#666666",
    "accent": "#F0F0F0",
    "accent-foreground": "#111111",
    "destructive": "#CC0000",
    "border": "#E0E0E0",
    "input": "#E0E0E0",
    "ring": "#000000",
    "sidebar-background": "#F5F5F5",
    "sidebar-foreground": "#111111",
    "sidebar-border": "#E0E0E0",
    "sidebar-accent": "#E8E8E8"
  },
  "typography": {
    "font-family": "'SF Mono', 'Menlo', monospace",
    "font-size-base": "13px"
  },
  "spacing": {
    "sidebar-width": "220px"
  }
}"##;

// ---------------------------------------------------------------------------
// Vault-based theme notes (markdown with frontmatter CSS custom properties)
// ---------------------------------------------------------------------------

/// Complete set of CSS variable key-value pairs for the default light vault theme.
/// Includes both UI chrome colours and all editor styling properties from theme.json.
/// Numeric values that need CSS units include the `px` suffix; unitless values
/// (line-height, font-weight) are bare numbers.
pub const DEFAULT_VAULT_THEME_VARS: [(&str, &str); 140] = [
    // ── shadcn/ui base colours ──────────────────────────────────────────
    ("background", "#FFFFFF"),
    ("foreground", "#37352F"),
    ("card", "#FFFFFF"),
    ("popover", "#FFFFFF"),
    ("primary", "#155DFF"),
    ("primary-foreground", "#FFFFFF"),
    ("secondary", "#EBEBEA"),
    ("secondary-foreground", "#37352F"),
    ("muted", "#F0F0EF"),
    ("muted-foreground", "#787774"),
    ("accent", "#EBEBEA"),
    ("accent-foreground", "#37352F"),
    ("destructive", "#E03E3E"),
    ("border", "#E9E9E7"),
    ("input", "#E9E9E7"),
    ("ring", "#155DFF"),
    ("sidebar", "#F7F6F3"),
    ("sidebar-foreground", "#37352F"),
    ("sidebar-border", "#E9E9E7"),
    ("sidebar-accent", "#EBEBEA"),
    // ── Text hierarchy ──────────────────────────────────────────────────
    ("text-primary", "#37352F"),
    ("text-secondary", "#787774"),
    ("text-tertiary", "#B4B4B4"),
    ("text-muted", "#B4B4B4"),
    ("text-heading", "#37352F"),
    // ── Backgrounds ─────────────────────────────────────────────────────
    ("bg-primary", "#FFFFFF"),
    ("bg-card", "#FFFFFF"),
    ("bg-sidebar", "#F7F6F3"),
    ("bg-hover", "#EBEBEA"),
    ("bg-hover-subtle", "#F0F0EF"),
    ("bg-selected", "#E8F4FE"),
    ("border-primary", "#E9E9E7"),
    // ── Accent colours ──────────────────────────────────────────────────
    ("accent-blue", "#155DFF"),
    ("accent-green", "#00B38B"),
    ("accent-orange", "#D9730D"),
    ("accent-red", "#E03E3E"),
    ("accent-purple", "#A932FF"),
    ("accent-yellow", "#F0B100"),
    ("accent-blue-light", "#155DFF14"),
    ("accent-green-light", "#00B38B14"),
    ("accent-purple-light", "#A932FF14"),
    ("accent-red-light", "#E03E3E14"),
    ("accent-yellow-light", "#F0B10014"),
    // ── Typography base ─────────────────────────────────────────────────
    (
        "font-family",
        "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    ),
    ("font-size-base", "14px"),
    // ── Editor (from theme.json → editor) ───────────────────────────────
    (
        "editor-font-family",
        "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    ),
    ("editor-font-size", "15px"),
    ("editor-line-height", "1.5"),
    ("editor-max-width", "720px"),
    ("editor-padding-horizontal", "40px"),
    ("editor-padding-vertical", "20px"),
    ("editor-paragraph-spacing", "8px"),
    // ── Headings H1 ────────────────────────────────────────────────────
    ("headings-h1-font-size", "32px"),
    ("headings-h1-font-weight", "700"),
    ("headings-h1-line-height", "1.2"),
    ("headings-h1-margin-top", "32px"),
    ("headings-h1-margin-bottom", "12px"),
    ("headings-h1-color", "var(--text-heading)"),
    ("headings-h1-letter-spacing", "-0.5px"),
    // ── Headings H2 ────────────────────────────────────────────────────
    ("headings-h2-font-size", "27px"),
    ("headings-h2-font-weight", "600"),
    ("headings-h2-line-height", "1.4"),
    ("headings-h2-margin-top", "28px"),
    ("headings-h2-margin-bottom", "10px"),
    ("headings-h2-color", "var(--text-heading)"),
    ("headings-h2-letter-spacing", "-0.5px"),
    // ── Headings H3 ────────────────────────────────────────────────────
    ("headings-h3-font-size", "20px"),
    ("headings-h3-font-weight", "600"),
    ("headings-h3-line-height", "1.4"),
    ("headings-h3-margin-top", "24px"),
    ("headings-h3-margin-bottom", "8px"),
    ("headings-h3-color", "var(--text-heading)"),
    ("headings-h3-letter-spacing", "-0.5px"),
    // ── Headings H4 ────────────────────────────────────────────────────
    ("headings-h4-font-size", "20px"),
    ("headings-h4-font-weight", "600"),
    ("headings-h4-line-height", "1.4"),
    ("headings-h4-margin-top", "20px"),
    ("headings-h4-margin-bottom", "6px"),
    ("headings-h4-color", "var(--text-heading)"),
    ("headings-h4-letter-spacing", "0px"),
    // ── Lists ───────────────────────────────────────────────────────────
    ("lists-bullet-size", "28px"),
    ("lists-bullet-color", "#177bfd"),
    ("lists-indent-size", "24px"),
    ("lists-item-spacing", "4px"),
    ("lists-padding-left", "8px"),
    ("lists-bullet-gap", "6px"),
    // ── Checkboxes ──────────────────────────────────────────────────────
    ("checkboxes-size", "18px"),
    ("checkboxes-border-radius", "3px"),
    ("checkboxes-checked-color", "var(--accent-blue)"),
    ("checkboxes-unchecked-border-color", "var(--text-muted)"),
    ("checkboxes-gap", "8px"),
    // ── Inline styles: bold ─────────────────────────────────────────────
    ("inline-styles-bold-font-weight", "700"),
    ("inline-styles-bold-color", "var(--text-primary)"),
    // ── Inline styles: italic ───────────────────────────────────────────
    ("inline-styles-italic-font-style", "italic"),
    ("inline-styles-italic-color", "var(--text-primary)"),
    // ── Inline styles: strikethrough ────────────────────────────────────
    ("inline-styles-strikethrough-color", "var(--text-tertiary)"),
    (
        "inline-styles-strikethrough-text-decoration",
        "line-through",
    ),
    // ── Inline styles: code ─────────────────────────────────────────────
    (
        "inline-styles-code-font-family",
        "'SF Mono', 'Fira Code', monospace",
    ),
    ("inline-styles-code-font-size", "14px"),
    (
        "inline-styles-code-background-color",
        "var(--bg-hover-subtle)",
    ),
    ("inline-styles-code-padding-horizontal", "4px"),
    ("inline-styles-code-padding-vertical", "2px"),
    ("inline-styles-code-border-radius", "3px"),
    ("inline-styles-code-color", "var(--text-secondary)"),
    // ── Inline styles: link ─────────────────────────────────────────────
    ("inline-styles-link-color", "var(--accent-blue)"),
    ("inline-styles-link-text-decoration", "underline"),
    // ── Inline styles: wikilink ─────────────────────────────────────────
    ("inline-styles-wikilink-color", "var(--accent-blue)"),
    ("inline-styles-wikilink-text-decoration", "none"),
    (
        "inline-styles-wikilink-border-bottom",
        "1px dotted currentColor",
    ),
    ("inline-styles-wikilink-cursor", "pointer"),
    // ── Code blocks ─────────────────────────────────────────────────────
    (
        "code-blocks-font-family",
        "'SF Mono', 'Fira Code', monospace",
    ),
    ("code-blocks-font-size", "13px"),
    ("code-blocks-line-height", "1.5"),
    ("code-blocks-background-color", "var(--bg-card)"),
    ("code-blocks-padding-horizontal", "16px"),
    ("code-blocks-padding-vertical", "12px"),
    ("code-blocks-border-radius", "6px"),
    ("code-blocks-margin-vertical", "12px"),
    // ── Blockquote ──────────────────────────────────────────────────────
    ("blockquote-border-left-width", "3px"),
    ("blockquote-border-left-color", "var(--accent-blue)"),
    ("blockquote-padding-left", "16px"),
    ("blockquote-margin-vertical", "12px"),
    ("blockquote-color", "var(--text-secondary)"),
    ("blockquote-font-style", "italic"),
    // ── Table ───────────────────────────────────────────────────────────
    ("table-border-color", "var(--border-primary)"),
    ("table-header-background", "var(--bg-card)"),
    ("table-cell-padding-horizontal", "12px"),
    ("table-cell-padding-vertical", "8px"),
    ("table-font-size", "14px"),
    // ── Horizontal rule ─────────────────────────────────────────────────
    ("horizontal-rule-color", "var(--border-primary)"),
    ("horizontal-rule-margin-vertical", "24px"),
    ("horizontal-rule-thickness", "1px"),
    // ── Colors (semantic aliases from theme.json → colors) ──────────────
    ("colors-background", "var(--bg-primary)"),
    ("colors-text", "var(--text-primary)"),
    ("colors-text-secondary", "var(--text-secondary)"),
    ("colors-text-muted", "var(--text-muted)"),
    ("colors-heading", "var(--text-heading)"),
    ("colors-accent", "var(--accent-blue)"),
    ("colors-selection", "var(--bg-selected)"),
    ("colors-cursor", "var(--text-primary)"),
];

/// UI-colour overrides for the Dark vault theme (keys that differ from default).
const DARK_COLOR_OVERRIDES: &[(&str, &str)] = &[
    ("background", "#0f0f1a"),
    ("foreground", "#e0e0e0"),
    ("card", "#16162a"),
    ("popover", "#1e1e3a"),
    ("secondary", "#2a2a4a"),
    ("secondary-foreground", "#e0e0e0"),
    ("muted", "#1e1e3a"),
    ("muted-foreground", "#888888"),
    ("accent", "#2a2a4a"),
    ("accent-foreground", "#e0e0e0"),
    ("destructive", "#f44336"),
    ("border", "#2a2a4a"),
    ("input", "#2a2a4a"),
    ("sidebar", "#1a1a2e"),
    ("sidebar-foreground", "#e0e0e0"),
    ("sidebar-border", "#2a2a4a"),
    ("sidebar-accent", "#2a2a4a"),
    ("text-primary", "#e0e0e0"),
    ("text-secondary", "#888888"),
    ("text-tertiary", "#666666"),
    ("text-muted", "#666666"),
    ("text-heading", "#e0e0e0"),
    ("bg-primary", "#0f0f1a"),
    ("bg-card", "#16162a"),
    ("bg-sidebar", "#1a1a2e"),
    ("bg-hover", "#2a2a4a"),
    ("bg-hover-subtle", "#1e1e3a"),
    ("bg-selected", "#155DFF22"),
    ("border-primary", "#2a2a4a"),
    ("accent-red", "#f44336"),
    ("accent-blue-light", "#155DFF33"),
    ("accent-green-light", "#00B38B33"),
    ("accent-purple-light", "#A932FF33"),
    ("accent-red-light", "#f4433633"),
    ("accent-yellow-light", "#F0B10033"),
    ("lists-bullet-color", "#155DFF"),
];

/// UI-colour + editor-property overrides for the Minimal vault theme.
const MINIMAL_OVERRIDES: &[(&str, &str)] = &[
    ("background", "#FAFAFA"),
    ("foreground", "#111111"),
    ("primary", "#000000"),
    ("secondary", "#F0F0F0"),
    ("secondary-foreground", "#111111"),
    ("muted", "#F5F5F5"),
    ("muted-foreground", "#666666"),
    ("accent", "#F0F0F0"),
    ("accent-foreground", "#111111"),
    ("destructive", "#CC0000"),
    ("border", "#E0E0E0"),
    ("input", "#E0E0E0"),
    ("ring", "#000000"),
    ("sidebar", "#F5F5F5"),
    ("sidebar-foreground", "#111111"),
    ("sidebar-border", "#E0E0E0"),
    ("sidebar-accent", "#E8E8E8"),
    ("text-primary", "#111111"),
    ("text-secondary", "#666666"),
    ("text-tertiary", "#999999"),
    ("text-muted", "#999999"),
    ("text-heading", "#111111"),
    ("bg-primary", "#FAFAFA"),
    ("bg-card", "#FFFFFF"),
    ("bg-sidebar", "#F5F5F5"),
    ("bg-hover", "#EBEBEB"),
    ("bg-hover-subtle", "#F5F5F5"),
    ("bg-selected", "#00000014"),
    ("border-primary", "#E0E0E0"),
    ("accent-blue", "#000000"),
    ("accent-green", "#006600"),
    ("accent-orange", "#996600"),
    ("accent-red", "#CC0000"),
    ("accent-purple", "#660099"),
    ("accent-yellow", "#996600"),
    ("accent-blue-light", "#00000014"),
    ("accent-green-light", "#00660014"),
    ("accent-purple-light", "#66009914"),
    ("accent-red-light", "#CC000014"),
    ("accent-yellow-light", "#99660014"),
    ("font-family", "'SF Mono', 'Menlo', monospace"),
    ("font-size-base", "13px"),
    ("editor-font-size", "15px"),
    ("editor-line-height", "1.6"),
    ("editor-max-width", "680px"),
    ("lists-bullet-color", "#000000"),
];

/// Build a vault theme note string from a set of CSS variable pairs.
///
/// Values containing `#`, `'`, `,`, or `(` are YAML-quoted to avoid parse errors.
fn build_vault_theme_note(name: &str, description: &str, vars: &[(&str, &str)]) -> String {
    let mut fm = format!("---\ntype: Theme\nDescription: {description}\n");
    for (key, value) in vars {
        if value.contains('#') || value.contains('\'') || value.contains(',') || value.contains('(')
        {
            fm.push_str(&format!("{key}: \"{value}\"\n"));
        } else {
            fm.push_str(&format!("{key}: {value}\n"));
        }
    }
    fm.push_str("---\n\n");
    fm.push_str(&format!("# {name} Theme\n\n{description}.\n"));
    fm
}

/// Apply overrides on top of DEFAULT_VAULT_THEME_VARS, returning a new Vec.
fn apply_overrides(
    overrides: &[(&'static str, &'static str)],
) -> Vec<(&'static str, &'static str)> {
    let mut vars: Vec<(&'static str, &'static str)> = DEFAULT_VAULT_THEME_VARS.to_vec();
    for &(key, value) in overrides {
        if let Some(entry) = vars.iter_mut().find(|e| e.0 == key) {
            entry.1 = value;
        }
    }
    vars
}

/// Generate the Default vault theme note content.
pub fn default_vault_theme() -> String {
    build_vault_theme_note(
        "Default",
        "Light theme with warm, paper-like tones",
        &DEFAULT_VAULT_THEME_VARS,
    )
}

/// Generate the Dark vault theme note content.
pub fn dark_vault_theme() -> String {
    let vars = apply_overrides(DARK_COLOR_OVERRIDES);
    build_vault_theme_note("Dark", "Dark variant with deep navy tones", &vars)
}

/// Generate the Minimal vault theme note content.
pub fn minimal_vault_theme() -> String {
    let vars = apply_overrides(MINIMAL_OVERRIDES);
    build_vault_theme_note("Minimal", "High contrast, minimal chrome", &vars)
}

/// Type definition for the Theme note type.
pub const THEME_TYPE_DEFINITION: &str = "---\n\
type: Type\n\
icon: palette\n\
color: purple\n\
order: 50\n\
---\n\
\n\
# Theme\n\
\n\
A visual theme for Laputa. Each theme defines CSS custom properties that control colors, typography, and spacing.\n";
