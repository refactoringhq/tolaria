use super::*;

fn request(
    content: &str,
    dependencies: Vec<SheetDependencyContent>,
    links: Vec<SheetExternalReferenceLink>,
) -> ResolveSheetExternalFormulaInputsRequest {
    ResolveSheetExternalFormulaInputsRequest {
        content: content.to_string(),
        current_path: "/vault/a.md".to_string(),
        dependencies,
        links,
        max_depth: Some(4),
        timezone: Some("UTC".to_string()),
    }
}

fn dependency(path: &str, content: &str) -> SheetDependencyContent {
    SheetDependencyContent {
        path: path.to_string(),
        content: content.to_string(),
    }
}

fn link(source_path: &str, target: &str, target_path: &str) -> SheetExternalReferenceLink {
    SheetExternalReferenceLink {
        source_path: source_path.to_string(),
        target: target.to_string(),
        target_path: target_path.to_string(),
    }
}

#[test]
fn resolves_direct_external_formula_input() {
    let response = resolve_sheet_external_formula_inputs_sync(request(
        "Total\n=[[b]].A1+5",
        vec![dependency("/vault/b.md", "40")],
        vec![link("/vault/a.md", "b", "/vault/b.md")],
    ))
    .unwrap();

    assert_eq!(
        response.inputs,
        vec![ResolvedSheetExternalFormulaInput {
            cell: "A2".to_string(),
            evaluated: "=40+5".to_string(),
            source: "=[[b]].A1+5".to_string(),
        }],
    );
}

#[test]
fn resolves_transitive_external_formula_input() {
    let response = resolve_sheet_external_formula_inputs_sync(request(
        "=[[b]].A1*2",
        vec![
            dependency("/vault/b.md", "=[[c]].A1+1"),
            dependency("/vault/c.md", "20"),
        ],
        vec![
            link("/vault/a.md", "b", "/vault/b.md"),
            link("/vault/b.md", "c", "/vault/c.md"),
        ],
    ))
    .unwrap();

    assert_eq!(response.inputs[0].evaluated, "=21*2");
}

#[test]
fn leaves_cycles_unresolved() {
    let response = resolve_sheet_external_formula_inputs_sync(request(
        "=[[b]].A1",
        vec![dependency("/vault/b.md", "=[[a]].A1")],
        vec![
            link("/vault/a.md", "b", "/vault/b.md"),
            link("/vault/b.md", "a", "/vault/a.md"),
        ],
    ))
    .unwrap();

    assert!(response.inputs.is_empty());
}
