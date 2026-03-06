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

/// CSS variable key-value pairs for the default light vault theme.
pub const DEFAULT_VAULT_THEME_VARS: [(&str, &str); 46] = [
    // shadcn/ui base
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
    // Text hierarchy
    ("text-primary", "#37352F"),
    ("text-secondary", "#787774"),
    ("text-muted", "#B4B4B4"),
    ("text-heading", "#37352F"),
    // Backgrounds
    ("bg-primary", "#FFFFFF"),
    ("bg-sidebar", "#F7F6F3"),
    ("bg-hover", "#EBEBEA"),
    ("bg-hover-subtle", "#F0F0EF"),
    ("bg-selected", "#E8F4FE"),
    ("border-primary", "#E9E9E7"),
    // Accent colours
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
    // Typography
    (
        "font-family",
        "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    ),
    ("font-size-base", "14px"),
    // Editor
    ("editor-font-size", "16"),
    ("editor-line-height", "1.5"),
    ("editor-max-width", "720"),
];

/// Vault-based theme note for the built-in Default theme.
pub const DEFAULT_VAULT_THEME: &str = "---\n\
Is A: Theme\n\
Description: Light theme with warm, paper-like tones\n\
background: \"#FFFFFF\"\n\
foreground: \"#37352F\"\n\
card: \"#FFFFFF\"\n\
popover: \"#FFFFFF\"\n\
primary: \"#155DFF\"\n\
primary-foreground: \"#FFFFFF\"\n\
secondary: \"#EBEBEA\"\n\
secondary-foreground: \"#37352F\"\n\
muted: \"#F0F0EF\"\n\
muted-foreground: \"#787774\"\n\
accent: \"#EBEBEA\"\n\
accent-foreground: \"#37352F\"\n\
destructive: \"#E03E3E\"\n\
border: \"#E9E9E7\"\n\
input: \"#E9E9E7\"\n\
ring: \"#155DFF\"\n\
sidebar: \"#F7F6F3\"\n\
sidebar-foreground: \"#37352F\"\n\
sidebar-border: \"#E9E9E7\"\n\
sidebar-accent: \"#EBEBEA\"\n\
text-primary: \"#37352F\"\n\
text-secondary: \"#787774\"\n\
text-muted: \"#B4B4B4\"\n\
text-heading: \"#37352F\"\n\
bg-primary: \"#FFFFFF\"\n\
bg-sidebar: \"#F7F6F3\"\n\
bg-hover: \"#EBEBEA\"\n\
bg-hover-subtle: \"#F0F0EF\"\n\
bg-selected: \"#E8F4FE\"\n\
border-primary: \"#E9E9E7\"\n\
accent-blue: \"#155DFF\"\n\
accent-green: \"#00B38B\"\n\
accent-orange: \"#D9730D\"\n\
accent-red: \"#E03E3E\"\n\
accent-purple: \"#A932FF\"\n\
accent-yellow: \"#F0B100\"\n\
accent-blue-light: \"#155DFF14\"\n\
accent-green-light: \"#00B38B14\"\n\
accent-purple-light: \"#A932FF14\"\n\
accent-red-light: \"#E03E3E14\"\n\
accent-yellow-light: \"#F0B10014\"\n\
font-family: \"'Inter', -apple-system, BlinkMacSystemFont, sans-serif\"\n\
font-size-base: 14px\n\
editor-font-size: 16\n\
editor-line-height: 1.5\n\
editor-max-width: 720\n\
---\n\
\n\
# Default Theme\n\
\n\
The default light theme for Laputa. Clean and warm, inspired by Notion.\n";

/// Vault-based theme note for the built-in Dark theme.
pub const DARK_VAULT_THEME: &str = "---\n\
Is A: Theme\n\
Description: Dark variant with deep navy tones\n\
background: \"#0f0f1a\"\n\
foreground: \"#e0e0e0\"\n\
card: \"#16162a\"\n\
popover: \"#1e1e3a\"\n\
primary: \"#155DFF\"\n\
primary-foreground: \"#FFFFFF\"\n\
secondary: \"#2a2a4a\"\n\
secondary-foreground: \"#e0e0e0\"\n\
muted: \"#1e1e3a\"\n\
muted-foreground: \"#888888\"\n\
accent: \"#2a2a4a\"\n\
accent-foreground: \"#e0e0e0\"\n\
destructive: \"#f44336\"\n\
border: \"#2a2a4a\"\n\
input: \"#2a2a4a\"\n\
ring: \"#155DFF\"\n\
sidebar: \"#1a1a2e\"\n\
sidebar-foreground: \"#e0e0e0\"\n\
sidebar-border: \"#2a2a4a\"\n\
sidebar-accent: \"#2a2a4a\"\n\
text-primary: \"#e0e0e0\"\n\
text-secondary: \"#888888\"\n\
text-muted: \"#666666\"\n\
text-heading: \"#e0e0e0\"\n\
bg-primary: \"#0f0f1a\"\n\
bg-sidebar: \"#1a1a2e\"\n\
bg-hover: \"#2a2a4a\"\n\
bg-hover-subtle: \"#1e1e3a\"\n\
bg-selected: \"#155DFF22\"\n\
border-primary: \"#2a2a4a\"\n\
accent-blue: \"#155DFF\"\n\
accent-green: \"#00B38B\"\n\
accent-orange: \"#D9730D\"\n\
accent-red: \"#f44336\"\n\
accent-purple: \"#A932FF\"\n\
accent-yellow: \"#F0B100\"\n\
accent-blue-light: \"#155DFF33\"\n\
accent-green-light: \"#00B38B33\"\n\
accent-purple-light: \"#A932FF33\"\n\
accent-red-light: \"#f4433633\"\n\
accent-yellow-light: \"#F0B10033\"\n\
font-family: \"'Inter', -apple-system, BlinkMacSystemFont, sans-serif\"\n\
font-size-base: 14px\n\
editor-font-size: 16\n\
editor-line-height: 1.5\n\
editor-max-width: 720\n\
---\n\
\n\
# Dark Theme\n\
\n\
A dark theme with deep navy tones for comfortable night-time reading.\n";

/// Vault-based theme note for the built-in Minimal theme.
pub const MINIMAL_VAULT_THEME: &str = "---\n\
Is A: Theme\n\
Description: High contrast, minimal chrome\n\
background: \"#FAFAFA\"\n\
foreground: \"#111111\"\n\
card: \"#FFFFFF\"\n\
popover: \"#FFFFFF\"\n\
primary: \"#000000\"\n\
primary-foreground: \"#FFFFFF\"\n\
secondary: \"#F0F0F0\"\n\
secondary-foreground: \"#111111\"\n\
muted: \"#F5F5F5\"\n\
muted-foreground: \"#666666\"\n\
accent: \"#F0F0F0\"\n\
accent-foreground: \"#111111\"\n\
destructive: \"#CC0000\"\n\
border: \"#E0E0E0\"\n\
input: \"#E0E0E0\"\n\
ring: \"#000000\"\n\
sidebar: \"#F5F5F5\"\n\
sidebar-foreground: \"#111111\"\n\
sidebar-border: \"#E0E0E0\"\n\
sidebar-accent: \"#E8E8E8\"\n\
text-primary: \"#111111\"\n\
text-secondary: \"#666666\"\n\
text-muted: \"#999999\"\n\
text-heading: \"#111111\"\n\
bg-primary: \"#FAFAFA\"\n\
bg-sidebar: \"#F5F5F5\"\n\
bg-hover: \"#EBEBEB\"\n\
bg-hover-subtle: \"#F5F5F5\"\n\
bg-selected: \"#00000014\"\n\
border-primary: \"#E0E0E0\"\n\
accent-blue: \"#000000\"\n\
accent-green: \"#006600\"\n\
accent-orange: \"#996600\"\n\
accent-red: \"#CC0000\"\n\
accent-purple: \"#660099\"\n\
accent-yellow: \"#996600\"\n\
accent-blue-light: \"#00000014\"\n\
accent-green-light: \"#00660014\"\n\
accent-purple-light: \"#66009914\"\n\
accent-red-light: \"#CC000014\"\n\
accent-yellow-light: \"#99660014\"\n\
font-family: \"'SF Mono', 'Menlo', monospace\"\n\
font-size-base: 13px\n\
editor-font-size: 15\n\
editor-line-height: 1.6\n\
editor-max-width: 680\n\
---\n\
\n\
# Minimal Theme\n\
\n\
High contrast, minimal chrome. Monospace typography throughout.\n";
