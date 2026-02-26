#!/usr/bin/env python3
"""
Restructure ui-design.pen into a proper design system.

Sections (top → bottom):
  0. Cover          — title, TOC
  1. Foundations     — colors, typography, spacing, shadows, heights
  2. Components      — atoms → molecules → organisms (reusable)
  3. Full Layouts    — 6 app variants at 1440×900
  4. Feature Specs   — existing frames reorganized by functional area
"""
import json
import copy
import sys
import os

PEN_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ui-design.pen")

def load():
    with open(PEN_FILE, "r") as f:
        return json.load(f)

def save(data):
    with open(PEN_FILE, "w") as f:
        json.dump(data, f, separators=(",", ":"))

# ─── Variable definitions ─────────────────────────────────────────
NEW_VARIABLES = {
    "--spacing-xs":           {"type": "number", "value": 4},
    "--spacing-sm":           {"type": "number", "value": 8},
    "--spacing-md":           {"type": "number", "value": 12},
    "--spacing-lg":           {"type": "number", "value": 16},
    "--spacing-xl":           {"type": "number", "value": 24},
    "--spacing-2xl":          {"type": "number", "value": 32},
    "--spacing-3xl":          {"type": "number", "value": 40},
    "--height-titlebar":      {"type": "number", "value": 38},
    "--height-tabbar":        {"type": "number", "value": 45},
    "--height-breadcrumb":    {"type": "number", "value": 45},
    "--height-statusbar":     {"type": "number", "value": 30},
    "--height-search-bar":    {"type": "number", "value": 40},
    "--height-note-item":     {"type": "number", "value": 64},
    "--height-inspector-header": {"type": "number", "value": 36},
    "--height-modal-header":  {"type": "number", "value": 56},
    "--height-modal-footer":  {"type": "number", "value": 56},
    "--shadow-sm":            {"type": "string", "value": "0 1px 2px rgba(0,0,0,0.05)"},
    "--shadow-md":            {"type": "string", "value": "0 4px 6px rgba(0,0,0,0.07)"},
    "--shadow-lg":            {"type": "string", "value": "0 10px 15px rgba(0,0,0,0.1)"},
    "--font-mono":            {"type": "string", "value": "IBM Plex Mono, monospace"},
    # Search panel colors (currently hardcoded)
    "--search-bg":            {"type": "color", "value": [
        {"value": "#FFFFFF"}, {"theme": {"Mode": "Dark"}, "value": "#1E1E2E"}
    ]},
    "--search-input-bg":      {"type": "color", "value": [
        {"value": "#F0F0EF"}, {"theme": {"Mode": "Dark"}, "value": "#2A2A3C"}
    ]},
}

# ─── Hardcoded color mappings ─────────────────────────────────────
# Maps hardcoded hex → variable name for replacement
HARDCODED_COLORS = {
    "#1E1E2E": "$--search-bg",
    "#1e1e2e": "$--search-bg",
    "#2A2A3C": "$--search-input-bg",
    "#2a2a3c": "$--search-input-bg",
    "#6b7280": "$--muted-foreground",
    "#f9fafb": "$--muted",
    "#f3f4f6": "$--muted",
    "#ffffff": "$--background",
    "#000000": "$--black",
    "#6366f1": "$--primary",
}

def replace_hardcoded_colors(node):
    """Recursively replace hardcoded hex colors with variable references."""
    if isinstance(node, dict):
        for key, val in list(node.items()):
            if key == "fill" and isinstance(val, str) and val.startswith("#"):
                lower = val.lower()
                if lower in HARDCODED_COLORS:
                    node[key] = HARDCODED_COLORS[lower]
            elif key == "fill" and isinstance(val, dict) and val.get("type") == "color":
                color = val.get("color", "")
                if isinstance(color, str) and color.lower() in HARDCODED_COLORS:
                    val["color"] = HARDCODED_COLORS[color.lower()]
            elif isinstance(val, (dict, list)):
                replace_hardcoded_colors(val)
    elif isinstance(node, list):
        for item in node:
            replace_hardcoded_colors(item)

# ─── Section header helper ────────────────────────────────────────
def make_section_header(sec_id, label, x, y):
    return {
        "type": "frame", "id": sec_id, "name": label,
        "x": x, "y": y, "width": 1440, "height": 60,
        "fill": "$--foreground", "padding": [0, 60],
        "alignItems": "center", "theme": {"Mode": "Light"},
        "children": [{
            "type": "text", "id": f"{sec_id}_lbl",
            "content": label.upper(),
            "fill": "$--background", "fontFamily": "Inter",
            "fontSize": 24, "fontWeight": "700", "letterSpacing": 2
        }]
    }

def make_subsection_label(sub_id, label, x, y):
    return {
        "type": "text", "id": sub_id,
        "content": label,
        "x": x, "y": y,
        "fill": "$--muted-foreground", "fontFamily": "Inter",
        "fontSize": 16, "fontWeight": "600", "letterSpacing": 1,
        "theme": {"Mode": "Light"}
    }

# ─── Cover ────────────────────────────────────────────────────────
def make_cover(x, y):
    return {
        "type": "frame", "id": "ds_cover", "name": "0 — Cover",
        "x": x, "y": y, "width": 1440, "height": "fit_content(400)",
        "fill": "$--background", "layout": "vertical",
        "gap": 32, "padding": [80, 60],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "ds_title", "content": "Laputa Design System",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 48,
             "fontWeight": "700", "letterSpacing": -1.5},
            {"type": "text", "id": "ds_subtitle",
             "content": "Wiki-linked knowledge management for deep thinkers",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 18, "lineHeight": 1.5},
            {"type": "rectangle", "id": "ds_div", "width": "fill_container", "height": 1, "fill": "$--border"},
            {"type": "frame", "id": "ds_toc", "name": "TOC", "layout": "vertical",
             "width": "fill_container", "gap": 16, "children": [
                {"type": "text", "id": "ds_toc_t", "content": "Table of Contents",
                 "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 20, "fontWeight": "600"},
                {"type": "frame", "id": "ds_toc_items", "layout": "vertical",
                 "width": "fill_container", "gap": 8, "children": [
                    {"type": "text", "id": "ds_t1", "fill": "$--primary", "fontFamily": "Inter",
                     "fontSize": 14, "fontWeight": "500",
                     "content": "1. Foundations — Colors, Typography, Spacing, Shadows, Heights"},
                    {"type": "text", "id": "ds_t2", "fill": "$--primary", "fontFamily": "Inter",
                     "fontSize": 14, "fontWeight": "500",
                     "content": "2. Components — Atoms, Molecules, Organisms"},
                    {"type": "text", "id": "ds_t3", "fill": "$--primary", "fontFamily": "Inter",
                     "fontSize": 14, "fontWeight": "500",
                     "content": "3. Full Layouts — 6 app variants at 1440×900"},
                    {"type": "text", "id": "ds_t4", "fill": "$--primary", "fontFamily": "Inter",
                     "fontSize": 14, "fontWeight": "500",
                     "content": "4. Feature Specs — All screens grouped by functional area"},
                ]}
            ]}
        ]
    }

# ─── Foundation frames ────────────────────────────────────────────
def make_spacing_scale(x, y):
    rows = []
    for var, px in [("xs", 4), ("sm", 8), ("md", 12), ("lg", 16), ("xl", 24), ("2xl", 32), ("3xl", 40)]:
        rid = f"sp_{var}"
        rows.append({
            "type": "frame", "id": rid, "layout": "horizontal",
            "gap": 16, "alignItems": "center", "width": "fill_container",
            "children": [
                {"type": "rectangle", "id": f"{rid}_box", "width": px, "height": 24,
                 "fill": "$--primary", "cornerRadius": 2},
                {"type": "text", "id": f"{rid}_lbl",
                 "content": f"--spacing-{var}: {px}px",
                 "fill": "$--foreground", "fontFamily": "IBM Plex Mono", "fontSize": 13}
            ]
        })
    return {
        "type": "frame", "id": "ds_spacing", "name": "Spacing Scale",
        "x": x, "y": y, "width": 700,
        "fill": "$--background", "layout": "vertical",
        "gap": 24, "padding": 40, "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "ds_sp_title", "content": "Spacing Scale",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 20, "fontWeight": "600"},
            {"type": "text", "id": "ds_sp_sub",
             "content": "Consistent spacing tokens used throughout the app.",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 13, "lineHeight": 1.5},
        ] + rows
    }

def make_heights_ref(x, y):
    items = [
        ("titlebar", 38, "$--sidebar"), ("tabbar", 45, "$--sidebar"),
        ("breadcrumb", 45, "$--background"), ("statusbar", 30, "$--sidebar"),
        ("modal-header", 56, "$--background"), ("inspector-header", 36, "$--background"),
    ]
    rows = []
    for name, px, fill in items:
        rid = f"ht_{name.replace('-','_')}"
        rows.append({
            "type": "frame", "id": rid, "layout": "horizontal",
            "gap": 16, "alignItems": "center", "width": "fill_container",
            "children": [
                {"type": "rectangle", "id": f"{rid}_bar", "width": 120, "height": px,
                 "fill": fill, "cornerRadius": "$--radius-sm",
                 "stroke": {"fill": "$--border", "thickness": 1}},
                {"type": "text", "id": f"{rid}_lbl",
                 "content": f"--height-{name}: {px}px",
                 "fill": "$--foreground", "fontFamily": "IBM Plex Mono", "fontSize": 13}
            ]
        })
    return {
        "type": "frame", "id": "ds_heights", "name": "Height Variables",
        "x": x, "y": y, "width": 700,
        "fill": "$--background", "layout": "vertical",
        "gap": 24, "padding": 40, "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "ds_ht_title", "content": "Height Variables",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 20, "fontWeight": "600"},
            {"type": "text", "id": "ds_ht_sub",
             "content": "Fixed heights for key layout regions.",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 13, "lineHeight": 1.5},
        ] + rows
    }

def make_shadows_ref(x, y):
    shadows = [
        ("SM", "0 1px 2px rgba(0,0,0,0.05)", {"type": "shadow", "offset": {"x": 0, "y": 1}, "blur": 2, "color": "#0000000D"}),
        ("MD", "0 4px 6px rgba(0,0,0,0.07)", {"type": "shadow", "offset": {"x": 0, "y": 4}, "blur": 6, "color": "#00000012"}),
        ("LG", "0 10px 15px rgba(0,0,0,0.1)", {"type": "shadow", "offset": {"x": 0, "y": 10}, "blur": 15, "color": "#0000001A"}),
    ]
    rows = []
    for name, desc, effect in shadows:
        rid = f"sh_{name.lower()}"
        rows.append({
            "type": "frame", "id": rid, "layout": "horizontal",
            "gap": 24, "alignItems": "center", "width": "fill_container",
            "children": [
                {"type": "frame", "id": f"{rid}_box", "width": 120, "height": 80,
                 "fill": "$--card", "cornerRadius": "$--radius-lg", "effect": effect},
                {"type": "frame", "id": f"{rid}_info", "layout": "vertical", "gap": 4, "children": [
                    {"type": "text", "id": f"{rid}_name", "content": f"Shadow {name}",
                     "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 14, "fontWeight": "600"},
                    {"type": "text", "id": f"{rid}_desc", "content": desc,
                     "fill": "$--muted-foreground", "fontFamily": "IBM Plex Mono", "fontSize": 11}
                ]}
            ]
        })
    return {
        "type": "frame", "id": "ds_shadows", "name": "Shadows",
        "x": x, "y": y, "width": 700,
        "fill": "$--background", "layout": "vertical",
        "gap": 32, "padding": 40, "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "ds_sh_title", "content": "Shadows",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 20, "fontWeight": "600"},
            {"type": "text", "id": "ds_sh_sub",
             "content": "Elevation levels for cards, modals, and popovers.",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 13, "lineHeight": 1.5},
        ] + rows
    }

# ─── Reusable Components ─────────────────────────────────────────

def make_component_status_dot(x, y):
    return {
        "type": "frame", "id": "comp_StatusDot", "name": "component/StatusDot",
        "reusable": True, "x": x, "y": y,
        "width": "fit_content(6)", "height": "fit_content(6)",
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "ellipse", "id": "StatusDot_dot", "width": 6, "height": 6,
             "fill": "$--accent-orange"}
        ]
    }

def make_component_separator(x, y):
    return {
        "type": "frame", "id": "comp_Separator", "name": "component/Separator",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(200)", "height": 1,
        "fill": "$--border",
        "theme": {"Mode": "Light"},
        "children": []
    }

def make_component_badge(x, y):
    """Colored pill badge — used for type badges, status badges, tags."""
    return {
        "type": "frame", "id": "comp_Badge", "name": "component/Badge",
        "reusable": True, "x": x, "y": y,
        "cornerRadius": 12, "fill": "$--accent-blue-light",
        "padding": [2, 8],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "Badge_label", "content": "Badge",
             "fill": "$--accent-blue", "fontFamily": "Inter", "fontSize": 12, "fontWeight": "500"}
        ]
    }

def make_component_button_primary(x, y):
    return {
        "type": "frame", "id": "comp_ButtonPrimary", "name": "component/Button/Primary",
        "reusable": True, "x": x, "y": y,
        "cornerRadius": "$--radius-md", "fill": "$--primary",
        "padding": [8, 16], "gap": 6, "alignItems": "center",
        "justifyContent": "center", "height": 36,
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "BtnPri_label", "content": "Button",
             "fill": "$--primary-foreground", "fontFamily": "Inter", "fontSize": 13, "fontWeight": "500"}
        ]
    }

def make_component_button_secondary(x, y):
    return {
        "type": "frame", "id": "comp_ButtonSecondary", "name": "component/Button/Secondary",
        "reusable": True, "x": x, "y": y,
        "cornerRadius": "$--radius-md", "fill": "$--secondary",
        "padding": [8, 16], "gap": 6, "alignItems": "center",
        "justifyContent": "center", "height": 36,
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "BtnSec_label", "content": "Button",
             "fill": "$--secondary-foreground", "fontFamily": "Inter", "fontSize": 13, "fontWeight": "500"}
        ]
    }

def make_component_button_ghost(x, y):
    return {
        "type": "frame", "id": "comp_ButtonGhost", "name": "component/Button/Ghost",
        "reusable": True, "x": x, "y": y,
        "cornerRadius": "$--radius-md",
        "padding": [8, 16], "gap": 6, "alignItems": "center",
        "justifyContent": "center", "height": 36,
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "BtnGho_label", "content": "Button",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13, "fontWeight": "500"}
        ]
    }

def make_component_input(x, y):
    return {
        "type": "frame", "id": "comp_Input", "name": "component/Input",
        "reusable": True, "x": x, "y": y,
        "width": 240, "height": 36,
        "cornerRadius": "$--radius-md", "fill": "$--background",
        "stroke": {"fill": "$--input", "thickness": 1, "align": "inside"},
        "padding": [0, 12], "alignItems": "center",
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "Input_placeholder", "content": "Placeholder...",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 13}
        ]
    }

def make_component_icon_button(x, y):
    return {
        "type": "frame", "id": "comp_IconButton", "name": "component/IconButton",
        "reusable": True, "x": x, "y": y,
        "width": 28, "height": 28,
        "cornerRadius": "$--radius-sm",
        "alignItems": "center", "justifyContent": "center",
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "icon_font", "id": "IconBtn_icon", "width": 16, "height": 16,
             "fill": "$--muted-foreground", "iconFontFamily": "lucide", "iconFontName": "plus"}
        ]
    }

# ─── Molecule Components ──────────────────────────────────────────

def make_component_inspector_header(x, y):
    return {
        "type": "frame", "id": "comp_InspectorHeader", "name": "component/InspectorHeader",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(320)", "height": "$--height-inspector-header",
        "justifyContent": "space_between", "alignItems": "center",
        "padding": [0, 12],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "frame", "id": "IH_left", "name": "leftGroup",
             "gap": 6, "alignItems": "center", "children": [
                {"type": "icon_font", "id": "IH_icon", "width": 16, "height": 16,
                 "fill": "$--muted-foreground", "iconFontFamily": "phosphor",
                 "iconFontName": "sliders-horizontal"},
                {"type": "text", "id": "IH_title", "content": "Properties",
                 "fill": "$--muted-foreground", "fontFamily": "Inter",
                 "fontSize": 13, "fontWeight": "600"}
            ]},
            {"type": "icon_font", "id": "IH_close", "width": 16, "height": 16,
             "fill": "$--muted-foreground", "iconFontFamily": "phosphor", "iconFontName": "x"}
        ]
    }

def make_component_note_list_item(x, y):
    return {
        "type": "frame", "id": "comp_NoteListItem", "name": "component/NoteListItem",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(340)", "layout": "vertical",
        "gap": 4, "padding": [14, 16],
        "stroke": {"align": "inside", "fill": "$--border", "thickness": {"bottom": 1}},
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "frame", "id": "NLI_titleRow", "name": "titleRow",
             "width": "fill_container", "justifyContent": "space_between", "alignItems": "center",
             "children": [
                {"type": "frame", "id": "NLI_titleGroup", "gap": 6, "alignItems": "center",
                 "children": [
                    {"type": "text", "id": "NLI_title", "content": "Note Title",
                     "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13, "fontWeight": "500"}
                ]},
                {"type": "text", "id": "NLI_time", "content": "2m ago",
                 "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 11}
            ]},
            {"type": "text", "id": "NLI_snippet",
             "content": "Preview text of the note content...",
             "fill": "$--muted-foreground", "fontFamily": "Inter",
             "fontSize": 12, "lineHeight": 1.5,
             "textGrowth": "fixed-width", "width": "fill_container"},
        ]
    }

def make_component_tab_active(x, y):
    return {
        "type": "frame", "id": "comp_TabActive", "name": "component/Tab/Active",
        "reusable": True, "x": x, "y": y,
        "height": "fill_container(45)", "gap": 6,
        "fill": "$--background", "alignItems": "center",
        "padding": [0, 14],
        "stroke": {"align": "inside", "fill": "$--border", "thickness": {"right": 1}},
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "TabA_label", "content": "Tab Title",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 12, "fontWeight": "500"},
            {"type": "icon_font", "id": "TabA_close", "width": 14, "height": 14,
             "fill": "$--muted-foreground", "iconFontFamily": "lucide", "iconFontName": "x"}
        ]
    }

def make_component_tab_inactive(x, y):
    return {
        "type": "frame", "id": "comp_TabInactive", "name": "component/Tab/Inactive",
        "reusable": True, "x": x, "y": y,
        "height": "fill_container(45)", "gap": 6,
        "alignItems": "center", "padding": [0, 14],
        "stroke": {"align": "inside", "fill": "$--sidebar-border",
                    "thickness": {"bottom": 1, "right": 1}},
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "TabI_label", "content": "Tab Title",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 12},
            {"type": "icon_font", "id": "TabI_close", "width": 14, "height": 14,
             "fill": "$--muted-foreground", "iconFontFamily": "lucide", "iconFontName": "x",
             "opacity": 0}
        ]
    }

def make_component_property_row(x, y):
    return {
        "type": "frame", "id": "comp_PropertyRow", "name": "component/PropertyRow",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(300)", "alignItems": "center",
        "cornerRadius": 4, "padding": [4, 6],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "PR_label", "content": "LABEL",
             "fill": "$--muted-foreground", "fontFamily": "IBM Plex Mono",
             "fontSize": 10, "fontWeight": "500", "letterSpacing": 1.2},
            {"type": "text", "id": "PR_value", "content": "Value",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13}
        ]
    }

def make_component_relationship_pill(x, y):
    return {
        "type": "frame", "id": "comp_RelationshipPill", "name": "component/RelationshipPill",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(280)", "cornerRadius": 6,
        "fill": "$--accent-blue-light", "gap": 6,
        "justifyContent": "space_between", "alignItems": "center",
        "padding": [6, 10],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "RP_title", "content": "Related Note",
             "fill": "$--accent-blue", "fontFamily": "Inter", "fontSize": 12, "fontWeight": "500"},
            {"type": "icon_font", "id": "RP_icon", "width": 14, "height": 14,
             "fill": "$--accent-blue", "iconFontFamily": "phosphor", "iconFontName": "wrench",
             "weight": 700}
        ]
    }

def make_component_sidebar_filter_item(x, y):
    return {
        "type": "frame", "id": "comp_SidebarFilterItem", "name": "component/SidebarFilterItem",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(250)", "cornerRadius": 6,
        "gap": 8, "alignItems": "center", "padding": [6, 16],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "icon_font", "id": "SFI_icon", "width": 16, "height": 16,
             "fill": "$--muted-foreground", "iconFontFamily": "lucide", "iconFontName": "folder"},
            {"type": "text", "id": "SFI_label", "content": "Filter Item",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13},
            {"type": "text", "id": "SFI_count", "content": "42",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 11}
        ]
    }

def make_component_section_label(x, y):
    return {
        "type": "frame", "id": "comp_SectionLabel", "name": "component/SectionLabel",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(280)", "padding": [0, 12],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "SL_label", "content": "SECTION",
             "fill": "$--muted-foreground", "fontFamily": "Inter",
             "fontSize": 10, "fontWeight": "600", "letterSpacing": 1.2}
        ]
    }

def make_component_section_count_header(x, y):
    return {
        "type": "frame", "id": "comp_SectionCountHeader", "name": "component/SectionCountHeader",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(280)", "justifyContent": "space_between",
        "alignItems": "center", "padding": [4, 0],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "SCH_label", "content": "SECTION",
             "fill": "$--muted-foreground", "fontFamily": "Inter",
             "fontSize": 10, "fontWeight": "600", "letterSpacing": 1.2},
            {"type": "text", "id": "SCH_count", "content": "3",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 11}
        ]
    }

def make_component_add_button(x, y):
    return {
        "type": "frame", "id": "comp_AddButton", "name": "component/AddButton",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(280)", "height": 32,
        "cornerRadius": 6, "justifyContent": "center", "alignItems": "center",
        "stroke": {"align": "inside", "fill": "$--border", "thickness": 1},
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "AB_label", "content": "+ Add property",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 12}
        ]
    }

def make_component_rel_group_label(x, y):
    return {
        "type": "frame", "id": "comp_RelGroupLabel", "name": "component/RelGroupLabel",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(280)", "justifyContent": "space_between",
        "alignItems": "center",
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "RGL_label", "content": "BELONGS TO",
             "fill": "$--muted-foreground", "fontFamily": "Inter",
             "fontSize": 10, "fontWeight": "600", "letterSpacing": 0.5},
            {"type": "text", "id": "RGL_count", "content": "3",
             "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 10}
        ]
    }

def make_component_command_palette_item(x, y):
    return {
        "type": "frame", "id": "comp_CommandPaletteItem", "name": "component/CommandPaletteItem",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(460)", "height": 40,
        "alignItems": "center", "gap": 12, "padding": [0, 16],
        "cornerRadius": "$--radius-md",
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "icon_font", "id": "CPI_icon", "width": 16, "height": 16,
             "fill": "$--muted-foreground", "iconFontFamily": "lucide", "iconFontName": "file-text"},
            {"type": "frame", "id": "CPI_content", "layout": "vertical",
             "width": "fill_container", "gap": 2, "children": [
                {"type": "text", "id": "CPI_title", "content": "Command Name",
                 "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13, "fontWeight": "500"},
            ]},
            {"type": "text", "id": "CPI_shortcut", "content": "⌘K",
             "fill": "$--muted-foreground", "fontFamily": "IBM Plex Mono", "fontSize": 11}
        ]
    }

def make_component_editable_value(x, y):
    return {
        "type": "frame", "id": "comp_EditableValue", "name": "component/EditableValue",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(200)",
        "alignItems": "center", "gap": 4,
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "text", "id": "EV_value", "content": "Editable Value",
             "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13},
            {"type": "icon_font", "id": "EV_edit", "width": 12, "height": 12,
             "fill": "$--muted-foreground", "iconFontFamily": "lucide", "iconFontName": "pencil",
             "opacity": 0}
        ]
    }

# ─── Organism Components ──────────────────────────────────────────

def make_component_toast(x, y):
    return {
        "type": "frame", "id": "comp_Toast", "name": "component/Toast",
        "reusable": True, "x": x, "y": y,
        "width": 360, "cornerRadius": "$--radius-lg",
        "fill": "$--card", "padding": [12, 16], "gap": 12,
        "alignItems": "center",
        "stroke": {"fill": "$--border", "thickness": 1},
        "effect": {"type": "shadow", "offset": {"x": 0, "y": 4}, "blur": 12, "color": "#0000001A"},
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "icon_font", "id": "Toast_icon", "width": 20, "height": 20,
             "fill": "$--accent-green", "iconFontFamily": "lucide", "iconFontName": "check-circle"},
            {"type": "frame", "id": "Toast_content", "layout": "vertical",
             "width": "fill_container", "gap": 2, "children": [
                {"type": "text", "id": "Toast_title", "content": "Success",
                 "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13, "fontWeight": "600"},
                {"type": "text", "id": "Toast_msg", "content": "Your changes have been saved.",
                 "fill": "$--muted-foreground", "fontFamily": "Inter", "fontSize": 12, "lineHeight": 1.4}
            ]},
            {"type": "icon_font", "id": "Toast_close", "width": 14, "height": 14,
             "fill": "$--muted-foreground", "iconFontFamily": "lucide", "iconFontName": "x"}
        ]
    }

def make_component_ai_chat_message(x, y):
    return {
        "type": "frame", "id": "comp_AIChatMessage", "name": "component/AIChatMessage",
        "reusable": True, "x": x, "y": y,
        "width": "fill_container(400)", "layout": "horizontal",
        "gap": 12, "padding": [12, 16],
        "theme": {"Mode": "Light"},
        "children": [
            {"type": "frame", "id": "AIM_avatar", "width": 28, "height": 28,
             "cornerRadius": 14, "fill": "$--accent-purple-light",
             "alignItems": "center", "justifyContent": "center",
             "children": [
                {"type": "icon_font", "id": "AIM_avatarIcon", "width": 16, "height": 16,
                 "fill": "$--accent-purple", "iconFontFamily": "lucide", "iconFontName": "sparkles"}
            ]},
            {"type": "frame", "id": "AIM_body", "layout": "vertical",
             "width": "fill_container", "gap": 4, "children": [
                {"type": "text", "id": "AIM_sender", "content": "AI Assistant",
                 "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 12, "fontWeight": "600"},
                {"type": "text", "id": "AIM_text",
                 "content": "Here's a summary of your recent notes...",
                 "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 13,
                 "lineHeight": 1.5, "textGrowth": "fixed-width", "width": "fill_container"}
            ]}
        ]
    }

# ─── Component showcase frame ─────────────────────────────────────
def make_component_showcase(x, y, title, components):
    """Creates a frame showing all component instances in a row for visual reference."""
    children = [
        {"type": "text", "id": f"showcase_{title.replace(' ','_')}_title",
         "content": title,
         "fill": "$--foreground", "fontFamily": "Inter", "fontSize": 18, "fontWeight": "600"},
    ]
    for comp_id, label in components:
        children.append({
            "type": "frame", "id": f"show_{comp_id}", "layout": "vertical", "gap": 8,
            "padding": [12, 0], "children": [
                {"type": "text", "id": f"show_{comp_id}_lbl", "content": label,
                 "fill": "$--muted-foreground", "fontFamily": "IBM Plex Mono", "fontSize": 10,
                 "letterSpacing": 0.5},
                {"type": "ref", "id": f"show_{comp_id}_ref", "ref": comp_id}
            ]
        })
    sid = f"showcase_{title.replace(' ', '_')}"
    return {
        "type": "frame", "id": sid, "name": f"Showcase — {title}",
        "x": x, "y": y, "width": 1440,
        "fill": "$--background", "layout": "vertical",
        "gap": 24, "padding": 40,
        "theme": {"Mode": "Light"},
        "children": children
    }

# ─── Feature spec grouping ────────────────────────────────────────
FEATURE_GROUPS = {
    "Tabs & Navigation": [
        "dt0", "dtj", "dt11", "rnt0", "rne0", "rns0",
        "archBtnNorm", "archBtnArc", "srtDD", "srtBN"
    ],
    "Inspector & Properties": [
        "pi01", "pi50", "rbF01", "rbF02", "rbF03",
        "reF01", "reF02", "reF03",
        "urlDefault", "urlHover", "urlEdit"
    ],
    "Note List & Virtual List": [
        "vl001", "vl100", "vl200", "vl300",
        "mni01", "dp01"
    ],
    "Sidebar & Sections": [
        "dsg01a", "dsg02w", "dsg04j", "csB01", "csA01", "trSB1"
    ],
    "Modals & Settings": [
        "iogBH", "ghv01", "ghv02", "ghv03", "ghv04"
    ],
    "Editor & Wikilinks": [
        "wlc01", "wlc20", "mb001", "mb011"
    ],
    "Status & Indicators": [
        "mni10", "mni20", "dp10", "dp20", "dp30"
    ],
    "Git & Changes": [
        "vc001", "vc100", "vc200", "ghCL1", "ghDO1"
    ],
    "Search": [
        "3aG9b", "K1O2x", "nrIcZ"
    ],
    "Trash": [
        "trNL1", "trRI1", "trW30"
    ],
}

# ─── Main transform ──────────────────────────────────────────────

def transform():
    data = load()

    # 1. Add new variables (merge, don't replace)
    for k, v in NEW_VARIABLES.items():
        data["variables"][k] = v

    # 2. Build an index of existing children by ID
    existing = {c["id"]: c for c in data["children"]}

    # 3. Fix hardcoded colors in ALL existing frames
    for child in data["children"]:
        replace_hardcoded_colors(child)

    # 4. Build new ordered children list
    new_children = []

    # ─── Section 0: Cover (y=0) ───
    new_children.append(make_cover(0, 0))

    # ─── Section 1: Foundations (y=500) ───
    new_children.append(make_section_header("sec1_hdr", "1 — Foundations", 0, 500))

    # Move existing Color Palette
    if "mOf4J" in existing:
        cp = existing.pop("mOf4J")
        cp["x"] = 0; cp["y"] = 600
        new_children.append(cp)

    # Move existing Typography & Spacing
    if "HZonq" in existing:
        ts = existing.pop("HZonq")
        ts["x"] = 0; ts["y"] = 1600
        new_children.append(ts)

    # New foundation frames
    new_children.append(make_spacing_scale(0, 3000))
    new_children.append(make_heights_ref(800, 3000))
    new_children.append(make_shadows_ref(0, 3600))

    # ─── Section 2: Components (y=4200) ───
    new_children.append(make_section_header("sec2_hdr", "2 — Components", 0, 4200))

    # Subsection labels
    new_children.append(make_subsection_label("sub_atoms", "ATOMS", 0, 4290))

    # Atom components (placed as reusable definitions)
    comp_y_atoms = 4320
    atom_components = [
        make_component_status_dot(0, comp_y_atoms),
        make_component_separator(100, comp_y_atoms),
        make_component_badge(400, comp_y_atoms),
        make_component_button_primary(0, comp_y_atoms + 60),
        make_component_button_secondary(200, comp_y_atoms + 60),
        make_component_button_ghost(400, comp_y_atoms + 60),
        make_component_input(0, comp_y_atoms + 120),
        make_component_icon_button(300, comp_y_atoms + 120),
    ]
    new_children.extend(atom_components)

    # Atom showcase
    new_children.append(make_component_showcase(0, comp_y_atoms + 200, "Atoms", [
        ("comp_StatusDot", "StatusDot"),
        ("comp_Separator", "Separator"),
        ("comp_Badge", "Badge"),
        ("comp_ButtonPrimary", "Button/Primary"),
        ("comp_ButtonSecondary", "Button/Secondary"),
        ("comp_ButtonGhost", "Button/Ghost"),
        ("comp_Input", "Input"),
        ("comp_IconButton", "IconButton"),
    ]))

    # Subsection: Molecules
    mol_y = 4900
    new_children.append(make_subsection_label("sub_molecules", "MOLECULES", 0, mol_y - 30))

    molecule_components = [
        make_component_inspector_header(0, mol_y),
        make_component_note_list_item(0, mol_y + 60),
        make_component_tab_active(400, mol_y),
        make_component_tab_inactive(600, mol_y),
        make_component_property_row(0, mol_y + 160),
        make_component_relationship_pill(0, mol_y + 220),
        make_component_sidebar_filter_item(400, mol_y + 160),
        make_component_section_label(0, mol_y + 280),
        make_component_section_count_header(400, mol_y + 280),
        make_component_add_button(0, mol_y + 340),
        make_component_rel_group_label(400, mol_y + 340),
        make_component_command_palette_item(0, mol_y + 400),
        make_component_editable_value(0, mol_y + 460),
    ]
    new_children.extend(molecule_components)

    # Molecule showcase
    new_children.append(make_component_showcase(0, mol_y + 520, "Molecules", [
        ("comp_InspectorHeader", "InspectorHeader"),
        ("comp_NoteListItem", "NoteListItem"),
        ("comp_TabActive", "Tab/Active"),
        ("comp_TabInactive", "Tab/Inactive"),
        ("comp_PropertyRow", "PropertyRow"),
        ("comp_RelationshipPill", "RelationshipPill"),
        ("comp_SidebarFilterItem", "SidebarFilterItem"),
        ("comp_SectionLabel", "SectionLabel"),
        ("comp_SectionCountHeader", "SectionCountHeader"),
        ("comp_AddButton", "AddButton"),
        ("comp_RelGroupLabel", "RelGroupLabel"),
        ("comp_CommandPaletteItem", "CommandPaletteItem"),
        ("comp_EditableValue", "EditableValue"),
    ]))

    # Subsection: Organisms
    org_y = 5900
    new_children.append(make_subsection_label("sub_organisms", "ORGANISMS", 0, org_y - 30))

    new_children.append(make_component_toast(0, org_y))
    new_children.append(make_component_ai_chat_message(0, org_y + 80))

    new_children.append(make_component_showcase(0, org_y + 200, "Organisms", [
        ("comp_Toast", "Toast"),
        ("comp_AIChatMessage", "AIChatMessage"),
    ]))

    # ─── Section 3: Full Layouts (y=6600) ───
    new_children.append(make_section_header("sec3_hdr", "3 — Full Layouts", 0, 6600))

    # Layout frames — move existing ones
    layout_ids = ["qHhaj", "SC_all", "SC_nosb", "SC_edonly", "SC_ednl"]
    layout_y = 6700
    for lid in layout_ids:
        if lid in existing:
            frame = existing.pop(lid)
            frame["x"] = 0
            frame["y"] = layout_y
            new_children.append(frame)
            layout_y += 1000  # 900px height + 100px gap

    # ─── Section 4: Feature Specs (y=12200) ───
    spec_y = 12200
    new_children.append(make_section_header("sec4_hdr", "4 — Feature Specs", 0, spec_y))
    spec_y += 100

    placed_ids = set()
    for group_name, group_ids in FEATURE_GROUPS.items():
        # Group label
        new_children.append(make_subsection_label(
            f"fg_{group_name.replace(' ', '_').replace('&','and').lower()[:20]}",
            group_name.upper(), 0, spec_y
        ))
        spec_y += 30

        group_x = 0
        max_h = 0
        for fid in group_ids:
            if fid in existing:
                frame = existing.pop(fid)
                fw = frame.get("width", 300)
                if isinstance(fw, str):
                    fw = 340  # fallback for dynamic widths

                # Wrap to next row if too wide
                if group_x + fw > 3000:
                    spec_y += max_h + 40
                    group_x = 0
                    max_h = 0

                frame["x"] = group_x
                frame["y"] = spec_y
                new_children.append(frame)
                placed_ids.add(fid)

                fh = frame.get("height", 200)
                if isinstance(fh, str):
                    fh = 400  # fallback
                max_h = max(max_h, fh)
                group_x += fw + 100

        spec_y += max_h + 80

    # Any remaining unplaced frames go at the end
    for fid, frame in existing.items():
        if fid not in placed_ids:
            frame["x"] = 0
            frame["y"] = spec_y
            new_children.append(frame)
            fh = frame.get("height", 200)
            if isinstance(fh, str):
                fh = 400
            spec_y += fh + 100

    # 5. Replace children
    data["children"] = new_children

    # 6. Save
    save(data)

    # Stats
    reusable_count = sum(1 for c in new_children if c.get("reusable"))
    print(f"✅ Restructured ui-design.pen")
    print(f"   Total nodes: {len(new_children)}")
    print(f"   Reusable components: {reusable_count}")
    print(f"   Variables: {len(data['variables'])}")
    print(f"   Hardcoded colors replaced in existing frames")
    print(f"   Canvas organized into 5 sections")

if __name__ == "__main__":
    transform()
