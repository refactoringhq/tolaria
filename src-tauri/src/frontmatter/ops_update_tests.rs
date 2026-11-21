use super::{update_frontmatter_content, FrontmatterScalar, FrontmatterValue};

struct UpdateCase<'a> {
    content: &'a str,
    key: &'a str,
    value: Option<FrontmatterValue>,
    expected_present: &'a [&'a str],
    expected_absent: &'a [&'a str],
}

fn assert_updated_content(case: UpdateCase<'_>) {
    let updated = update_frontmatter_content(case.content, case.key, case.value).unwrap();
    for expected in case.expected_present {
        assert!(
            updated.contains(expected),
            "missing expected snippet: {expected}"
        );
    }
    for unexpected in case.expected_absent {
        assert!(
            !updated.contains(unexpected),
            "found unexpected snippet: {unexpected}"
        );
    }
}

fn assert_update_cases(cases: impl IntoIterator<Item = UpdateCase<'static>>) {
    for case in cases {
        assert_updated_content(case);
    }
}

#[test]
fn test_update_frontmatter_replaces_or_adds_string_fields() {
    let cases = [
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "Status",
            value: Some(FrontmatterValue::String("Active".to_string())),
            expected_present: &["Status: Active"],
            expected_absent: &["Status: Draft"],
        },
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "Owner",
            value: Some(FrontmatterValue::String("Luca".to_string())),
            expected_present: &["Owner: Luca", "Status: Draft"],
            expected_absent: &[],
        },
        UpdateCase {
            content: "---\n\"Is A\": Note\n---\n# Test\n",
            key: "Is A",
            value: Some(FrontmatterValue::String("Project".to_string())),
            expected_present: &["type: Project"],
            expected_absent: &["\"Is A\": Note", "\"Is A\": Project"],
        },
    ];

    assert_update_cases(cases);
}

#[test]
fn test_update_frontmatter_adds_typed_scalar_fields() {
    let cases = [
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "Reviewed",
            value: Some(FrontmatterValue::Bool(true)),
            expected_present: &["Reviewed: true"],
            expected_absent: &[],
        },
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "Priority",
            value: Some(FrontmatterValue::Number(5.0)),
            expected_present: &["Priority: 5"],
            expected_absent: &[],
        },
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "Score",
            value: Some(FrontmatterValue::Number(9.5)),
            expected_present: &["Score: 9.5"],
            expected_absent: &[],
        },
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "ClearMe",
            value: Some(FrontmatterValue::Null),
            expected_present: &["ClearMe: null"],
            expected_absent: &[],
        },
    ];

    assert_update_cases(cases);
}

#[test]
fn test_update_frontmatter_list_and_delete_paths() {
    let list_cases = [
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "aliases",
            value: Some(FrontmatterValue::List(vec![
                FrontmatterScalar::String("Alias1".to_string()),
                FrontmatterScalar::String("Alias2".to_string()),
            ])),
            expected_present: &["aliases:", "  - Alias1", "  - Alias2"],
            expected_absent: &[],
        },
        UpdateCase {
            content: "---\naliases:\n  - Old1\n  - Old2\nStatus: Draft\n---\n# Test\n",
            key: "aliases",
            value: Some(FrontmatterValue::List(vec![FrontmatterScalar::String(
                "New1".to_string(),
            )])),
            expected_present: &["  - New1", "Status: Draft"],
            expected_absent: &["Old1", "Old2"],
        },
        UpdateCase {
            content: "---\naliases:\n  - Alias1\n  - Alias2\nStatus: Draft\n---\n# Test\n",
            key: "aliases",
            value: None,
            expected_present: &["Status: Draft"],
            expected_absent: &["aliases", "Alias1"],
        },
        UpdateCase {
            content: "---\nStatus: Draft\nOwner: Luca\n---\n# Test\n",
            key: "Owner",
            value: None,
            expected_present: &["Status: Draft"],
            expected_absent: &["Owner"],
        },
        UpdateCase {
            content: "---\nStatus: Draft\n---\n# Test\n",
            key: "tags",
            value: Some(FrontmatterValue::List(vec![])),
            expected_present: &["tags: []"],
            expected_absent: &[],
        },
    ];

    assert_update_cases(list_cases);
}

#[test]
fn test_update_frontmatter_handles_missing_or_malformed_frontmatter() {
    let inserted = update_frontmatter_content(
        "# Test\n\nSome content here.",
        "Status",
        Some(FrontmatterValue::String("Draft".to_string())),
    )
    .unwrap();
    assert!(inserted.starts_with("---\n"));
    assert!(inserted.contains("Status: Draft"));
    assert!(inserted.contains("# Test"));

    let malformed = update_frontmatter_content(
        "---\nStatus: Draft\nNo closing fence here",
        "Status",
        Some(FrontmatterValue::String("Active".to_string())),
    );
    assert!(malformed.is_err());
    assert!(malformed.unwrap_err().contains("Malformed frontmatter"));

    let unchanged =
        update_frontmatter_content("---\nStatus: Draft\n---\n# Test\n", "Missing", None).unwrap();
    assert_eq!(unchanged, "---\nStatus: Draft\n---\n# Test\n");

    let no_frontmatter =
        update_frontmatter_content("# Test\n\nSome content.", "Missing", None).unwrap();
    assert_eq!(no_frontmatter, "# Test\n\nSome content.");
}

#[test]
fn test_update_frontmatter_canonicalizes_system_metadata_keys() {
    let cases = [
        UpdateCase {
            content: "---\narchived: false\n---\n# Test\n",
            key: "_archived",
            value: Some(FrontmatterValue::Bool(true)),
            expected_present: &["_archived: true"],
            expected_absent: &["archived: false"],
        },
        UpdateCase {
            content: "---\nicon: rocket\n---\n# Test\n",
            key: "icon",
            value: Some(FrontmatterValue::String("star".to_string())),
            expected_present: &["_icon: star"],
            expected_absent: &["\nicon:", "rocket"],
        },
        UpdateCase {
            content: "---\nsidebar label: Projects\nsidebar_label: Legacy\n---\n# Test\n",
            key: "_sidebar_label",
            value: Some(FrontmatterValue::String("Programs".to_string())),
            expected_present: &["_sidebar_label: Programs"],
            expected_absent: &["sidebar label: Projects", "sidebar_label: Legacy"],
        },
        UpdateCase {
            content: "---\nsort: modified:desc\n_sort: title:asc\n---\n# Test\n",
            key: "_sort",
            value: None,
            expected_present: &["# Test"],
            expected_absent: &["\nsort:", "\n_sort:"],
        },
    ];

    assert_update_cases(cases);
}

#[test]
fn test_update_frontmatter_canonicalizes_type_key_case() {
    let cases = [
        UpdateCase {
            content: "---\nType: Note\n---\n# Test\n",
            key: "type",
            value: Some(FrontmatterValue::String("Project".to_string())),
            expected_present: &["type: Project"],
            expected_absent: &["Type: Note"],
        },
        UpdateCase {
            content: "---\n\"Is A\": Note\nis_a: Topic\n---\n# Test\n",
            key: "type",
            value: Some(FrontmatterValue::String("Project".to_string())),
            expected_present: &["type: Project"],
            expected_absent: &["\"Is A\": Note", "is_a: Topic"],
        },
        UpdateCase {
            content: "---\nTYPE: Note\n---\n# Test\n",
            key: "Type",
            value: Some(FrontmatterValue::String("Person".to_string())),
            expected_present: &["type: Person"],
            expected_absent: &["TYPE: Note"],
        },
        UpdateCase {
            content: "---\nType: Note\nstatus: Active\n---\n# Test\n",
            key: "type",
            value: None,
            expected_present: &["status: Active", "# Test"],
            expected_absent: &["Type: Note", "\ntype:"],
        },
    ];

    assert_update_cases(cases);
}

/// Golden cases shared with the web port of these operations
/// (`src/lib/frontmatterText/ops.ts`): both read the same fixture file and must produce
/// the same bytes, so a property written on the web is the one the desktop would write.
mod golden {
    use super::{update_frontmatter_content, FrontmatterValue};
    use serde::Deserialize;

    const GOLDEN_CASES_JSON: &str =
        include_str!("../../../tests/fixtures/frontmatter-ops/cases.json");

    #[derive(Deserialize)]
    struct GoldenFile {
        cases: Vec<GoldenCase>,
    }

    #[derive(Deserialize)]
    struct GoldenCase {
        name: String,
        content: String,
        key: String,
        op: String,
        #[serde(default)]
        value: serde_json::Value,
        expected: Option<String>,
        error: Option<String>,
    }

    impl GoldenCase {
        fn value(&self) -> Option<FrontmatterValue> {
            match self.op.as_str() {
                "update" => Some(
                    serde_json::from_value(self.value.clone())
                        .unwrap_or_else(|err| panic!("{}: bad value: {err}", self.name)),
                ),
                "delete" => None,
                other => panic!("{}: unknown op {other}", self.name),
            }
        }
    }

    fn golden_cases() -> Vec<GoldenCase> {
        serde_json::from_str::<GoldenFile>(GOLDEN_CASES_JSON)
            .expect("golden cases must parse")
            .cases
    }

    #[test]
    fn frontmatter_updates_match_the_shared_golden_cases() {
        let cases = golden_cases();
        assert!(!cases.is_empty());
        for case in cases {
            let result = update_frontmatter_content(&case.content, &case.key, case.value());
            match (&case.expected, &case.error) {
                (Some(expected), None) => {
                    assert_eq!(result.as_ref(), Ok(expected), "{}", case.name)
                }
                (None, Some(error)) => assert_eq!(result.as_ref(), Err(error), "{}", case.name),
                _ => panic!("{}: needs exactly one of expected or error", case.name),
            }
        }
    }
}
