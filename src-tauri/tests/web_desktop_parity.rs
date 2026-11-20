//! Desktop parity for notes created and edited on the web (TOL-228).
//!
//! `apps/server/test/desktopParity.test.ts` runs scripted edits through the web client and
//! the server and checks in what every step leaves (`steps.json`). These tests replay the
//! same operations through the desktop's own code and require the same bytes: property edits
//! through `update_frontmatter_content`, renames with link rewrite through `rename_note`,
//! attachment names through `save_image`. `scan_vault` then reads the vault after every step;
//! that reading is the `entries.json` golden, which the web's vault index is checked against.
//!
//! Regenerate with `apps/server/scripts/regenerate-desktop-parity.sh`.

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde_json::{Map, Value};
use tempfile::TempDir;
use tolaria_lib::frontmatter::{update_frontmatter_content, FrontmatterScalar, FrontmatterValue};
use tolaria_lib::vault::{rename_note, save_image, scan_vault, RenameNoteRequest};

type Notes = BTreeMap<String, String>;

/// What the desktop reads from a note: the fields the note list, the properties panel and
/// the link graph show.
const ENTRY_FIELDS: [&str; 14] = [
    "title",
    "isA",
    "aliases",
    "belongsTo",
    "relatedTo",
    "status",
    "relationships",
    "outgoingLinks",
    "properties",
    "wordCount",
    "hasH1",
    "snippet",
    "fileKind",
    "fileSize",
];

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../apps/server/test/fixtures/desktop-parity")
}

fn read_json(name: &str) -> Value {
    let text = fs::read_to_string(fixtures().join(name)).expect("golden file");
    serde_json::from_str(&text).expect("golden JSON")
}

fn text(value: &Value) -> &str {
    value.as_str().expect("a string")
}

fn notes_of(value: &Value) -> Notes {
    let object = value.as_object().expect("notes");
    object
        .iter()
        .map(|(path, content)| (path.clone(), text(content).to_string()))
        .collect()
}

fn apply_changes(notes: &mut Notes, step: &Value) {
    for (path, content) in step["changed"].as_object().expect("changed notes") {
        match content.as_str() {
            Some(content) => notes.insert(path.clone(), content.to_string()),
            None => notes.remove(path),
        };
    }
}

/// The golden script: the seed notes, then every step with the notes as they were before it.
fn script() -> (Value, Vec<(Value, Notes)>) {
    let golden = read_json("steps.json");
    let mut notes = notes_of(&golden["seed"]);
    let mut steps = Vec::new();
    for step in golden["steps"].as_array().expect("steps") {
        steps.push((step.clone(), notes.clone()));
        apply_changes(&mut notes, step);
    }
    (golden, steps)
}

fn steps_of(op: &str) -> Vec<(Value, Notes)> {
    let (_, steps) = script();
    steps
        .into_iter()
        .filter(|(step, _)| step["op"] == op)
        .collect()
}

fn frontmatter_value(value: &Value) -> Option<FrontmatterValue> {
    match value {
        Value::String(text) => Some(FrontmatterValue::String(text.clone())),
        Value::Number(number) => Some(FrontmatterValue::Number(number.as_f64()?)),
        Value::Bool(flag) => Some(FrontmatterValue::Bool(*flag)),
        Value::Array(items) => Some(FrontmatterValue::List(
            items
                .iter()
                .map(|item| match item {
                    Value::String(text) => Some(FrontmatterScalar::String(text.clone())),
                    Value::Number(number) => Some(FrontmatterScalar::Number(number.as_f64()?)),
                    Value::Bool(flag) => Some(FrontmatterScalar::Bool(*flag)),
                    Value::Null => Some(FrontmatterScalar::Null),
                    _ => None,
                })
                .collect::<Option<Vec<_>>>()?,
        )),
        _ => None,
    }
}

/// The single note a step changed, by its path when it was given one.
fn changed_note(step: &Value) -> (String, String) {
    let changed = step["changed"].as_object().expect("changed notes");
    assert_eq!(changed.len(), 1, "one note changed: {step}");
    let (path, content) = changed.iter().next().expect("a changed note");
    (path.clone(), text(content).to_string())
}

fn write_vault(dir: &Path, notes: &Notes, attachments: &Map<String, Value>) {
    for (path, content) in notes {
        let file = dir.join(path);
        fs::create_dir_all(file.parent().expect("a folder")).expect("folder");
        fs::write(file, content).expect("note");
    }
    for (path, encoded) in attachments {
        let bytes = STANDARD.decode(text(encoded)).expect("base64");
        fs::create_dir_all(dir.join(path).parent().expect("a folder")).expect("folder");
        fs::write(dir.join(path), bytes).expect("attachment");
    }
}

fn markdown_files(dir: &Path, prefix: &str, notes: &mut Notes) {
    for entry in fs::read_dir(dir).expect("folder").flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            markdown_files(&path, &format!("{prefix}{name}/"), notes);
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path).expect("note");
            notes.insert(format!("{prefix}{name}"), content);
        }
    }
}

#[test]
fn desktop_property_edits_write_the_web_bytes() {
    let edits = steps_of("property");
    assert!(edits.len() >= 10, "the script edits properties");
    for (step, before) in edits {
        let (path, expected) = changed_note(&step);
        let value = step.get("value").and_then(frontmatter_value);
        let key = text(&step["key"]);
        let written = update_frontmatter_content(&before[&path], key, value).expect("update");
        assert_eq!(written, expected, "{path}: {key}");
    }
}

#[test]
fn desktop_renames_rewrite_the_web_links() {
    let renames = steps_of("rename");
    assert!(renames.len() >= 3, "the script renames notes");
    for (step, before) in renames {
        let vault = TempDir::new().expect("vault");
        write_vault(vault.path(), &before, &Map::new());
        let old_path = vault.path().join(text(&step["path"]));
        rename_note(RenameNoteRequest {
            vault_path: vault.path().to_str().expect("utf-8"),
            old_path: old_path.to_str().expect("utf-8"),
            new_title: text(&step["newTitle"]),
            old_title_hint: step["oldTitle"].as_str(),
        })
        .expect("rename");
        let mut expected = before.clone();
        apply_changes(&mut expected, &step);
        let mut renamed = Notes::new();
        markdown_files(vault.path(), "", &mut renamed);
        assert_eq!(renamed, expected, "rename of {}", step["path"]);
    }
}

#[test]
fn desktop_names_an_uploaded_image_like_the_web() {
    let uploads = steps_of("attachment");
    assert!(!uploads.is_empty(), "the script uploads an image");
    for (step, _) in uploads {
        let vault = TempDir::new().expect("vault");
        let stored = save_image(
            vault.path().to_str().expect("utf-8"),
            text(&step["filename"]),
            "",
        )
        .expect("saved");
        let desktop_name = Path::new(&stored).file_name().expect("a name");
        let web_name = text(&step["stored"]).rsplit('/').next().expect("a name");
        let strip_time = |name: &str| name.split_once('-').map(|(_, rest)| rest.to_string());
        assert_eq!(
            strip_time(&desktop_name.to_string_lossy()),
            strip_time(web_name)
        );
        assert!(text(&step["stored"]).starts_with("attachments/"));
    }
}

fn sorted(value: Value) -> Value {
    match value {
        Value::Object(object) => {
            let ordered: BTreeMap<String, Value> = object
                .into_iter()
                .map(|(key, value)| (key, sorted(value)))
                .collect();
            Value::Object(ordered.into_iter().collect())
        }
        Value::Array(items) => Value::Array(items.into_iter().map(sorted).collect()),
        other => other,
    }
}

/// `scan_vault` on the notes after a step: what the desktop shows for each, by path.
fn desktop_reading(notes: &Notes, attachments: &Map<String, Value>) -> Value {
    let vault = TempDir::new().expect("vault");
    write_vault(vault.path(), notes, attachments);
    let mut reading = Map::new();
    for entry in scan_vault(vault.path(), &HashMap::new()).expect("scan") {
        let path = Path::new(&entry.path)
            .strip_prefix(vault.path())
            .expect("inside");
        let path = path.to_string_lossy().replace('\\', "/");
        let full = serde_json::to_value(&entry).expect("entry");
        let fields = ENTRY_FIELDS
            .iter()
            .map(|key| (key.to_string(), full[*key].clone()));
        reading.insert(path, Value::Object(fields.collect()));
    }
    sorted(Value::Object(reading))
}

/// The attachments stored by the steps up to and including `upto`.
fn attachments_until(golden: &Value, steps: &[(Value, Notes)], upto: usize) -> Map<String, Value> {
    let all = golden["attachments"].as_object().expect("attachments");
    steps[..=upto]
        .iter()
        .filter_map(|(step, _)| step["stored"].as_str())
        .map(|path| (path.to_string(), all[path].clone()))
        .collect()
}

/// The entries a step changed: each new or changed entry, `null` for one that is gone.
fn reading_change(before: &Value, after: &Value) -> Value {
    let empty = Map::new();
    let before = before.as_object().unwrap_or(&empty);
    let after = after.as_object().expect("a reading");
    let changed = after
        .iter()
        .filter(|(path, entry)| before.get(*path) != Some(*entry))
        .map(|(path, entry)| (path.clone(), entry.clone()));
    let gone = before
        .keys()
        .filter(|path| !after.contains_key(*path))
        .map(|path| (path.clone(), Value::Null));
    Value::Object(changed.chain(gone).collect())
}

#[test]
fn desktop_reads_every_step_like_the_golden() {
    let (golden, steps) = script();
    let mut previous = Value::Null;
    let mut changes = Vec::new();
    for (index, (step, before)) in steps.iter().enumerate() {
        let mut after = before.clone();
        apply_changes(&mut after, step);
        let reading = desktop_reading(&after, &attachments_until(&golden, &steps, index));
        changes.push(reading_change(&previous, &reading));
        previous = reading;
    }
    let path = fixtures().join("entries.json");
    if std::env::var("REGENERATE_GOLDEN").as_deref() == Ok("1") {
        let json = serde_json::to_string_pretty(&changes).expect("JSON");
        fs::write(&path, format!("{json}\n")).expect("write golden");
    }
    let expected: Vec<Value> = serde_json::from_value(read_json("entries.json")).expect("readings");
    assert_eq!(changes.len(), expected.len());
    for (index, (change, expected)) in changes.iter().zip(&expected).enumerate() {
        assert_eq!(change, expected, "desktop reading after step {}", index + 1);
    }
}
