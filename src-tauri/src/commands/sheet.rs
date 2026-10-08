use ironcalc_base::Model;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[path = "sheet_format.rs"]
mod format;

use format::{
    cell_address, column_index_from_name, external_cell_formula_literal, external_ref_regex,
    is_external_formula_input, link_key, parse_sheet_markdown_cell_value, parse_sheet_rows,
    wikilink_target, workbook_name_from_path, SheetText,
};

const SHEET_INDEX: u32 = 0;
const DEFAULT_MAX_DEPTH: usize = 4;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetDependencyContent {
    pub path: String,
    pub content: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetExternalReferenceLink {
    pub source_path: String,
    pub target: String,
    pub target_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveSheetExternalFormulaInputsRequest {
    pub content: String,
    pub current_path: String,
    pub dependencies: Vec<SheetDependencyContent>,
    pub links: Vec<SheetExternalReferenceLink>,
    pub max_depth: Option<usize>,
    pub timezone: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSheetExternalFormulaInput {
    pub cell: String,
    pub evaluated: String,
    pub source: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveSheetExternalFormulaInputsResponse {
    pub inputs: Vec<ResolvedSheetExternalFormulaInput>,
}

#[tauri::command]
pub async fn resolve_sheet_external_formula_inputs(
    request: ResolveSheetExternalFormulaInputsRequest,
) -> Result<ResolveSheetExternalFormulaInputsResponse, String> {
    tokio::task::spawn_blocking(move || resolve_sheet_external_formula_inputs_sync(request))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}

fn resolve_sheet_external_formula_inputs_sync(
    request: ResolveSheetExternalFormulaInputsRequest,
) -> Result<ResolveSheetExternalFormulaInputsResponse, String> {
    let mut resolver = ExternalFormulaResolver::new(request);
    resolver.resolve_current_sheet()
}

struct ExternalFormulaResolver {
    content_by_path: HashMap<String, String>,
    current_path: String,
    link_targets: HashMap<String, String>,
    max_depth: usize,
    sheet_literal_cache: HashMap<String, HashMap<String, String>>,
    timezone: String,
}

struct ResolveStack {
    depth: usize,
    paths: HashSet<String>,
}

struct SheetBuildInputs {
    external_inputs: HashMap<String, String>,
    unresolved_external_cells: HashSet<String>,
}

struct SheetRows<'a> {
    path: &'a str,
    rows: &'a [Vec<String>],
}

struct ExternalReference<'a> {
    raw: &'a str,
    target: String,
    column_absolute: &'a str,
    column: &'a str,
    row_absolute: &'a str,
    row: &'a str,
}

impl<'a> ExternalReference<'a> {
    fn from_captures(captures: &'a regex::Captures<'a>) -> Self {
        let capture = |index| {
            captures
                .get(index)
                .map(|value| value.as_str())
                .unwrap_or_default()
        };
        Self {
            raw: capture(0),
            target: wikilink_target(SheetText::new(capture(1))),
            column_absolute: capture(2),
            column: capture(3),
            row_absolute: capture(4),
            row: capture(5),
        }
    }

    fn local_cell_reference(&self) -> String {
        format!(
            "{}{}{}{}",
            self.column_absolute,
            self.column.to_ascii_uppercase(),
            self.row_absolute,
            self.row,
        )
    }

    fn address(&self) -> Option<String> {
        let row = self.row.parse::<usize>().ok()?;
        let column = column_index_from_name(SheetText::new(self.column))?;
        Some(cell_address(row, column))
    }
}

impl ResolveStack {
    fn new(root_path: &str) -> Self {
        Self {
            depth: 0,
            paths: HashSet::from([root_path.to_string()]),
        }
    }

    fn can_enter(&self, path: &str, max_depth: usize) -> bool {
        self.depth < max_depth && !self.paths.contains(path)
    }

    fn enter(&mut self, path: &str) {
        self.depth += 1;
        self.paths.insert(path.to_string());
    }

    fn exit(&mut self, path: &str) {
        self.depth = self.depth.saturating_sub(1);
        self.paths.remove(path);
    }
}

impl ExternalFormulaResolver {
    fn new(request: ResolveSheetExternalFormulaInputsRequest) -> Self {
        let mut content_by_path = HashMap::from([(request.current_path.clone(), request.content)]);
        for dependency in request.dependencies {
            content_by_path.insert(dependency.path, dependency.content);
        }

        let link_targets = request
            .links
            .into_iter()
            .map(|link| {
                (
                    link_key(
                        SheetText::new(&link.source_path),
                        SheetText::new(&link.target),
                    ),
                    link.target_path,
                )
            })
            .collect();

        Self {
            content_by_path,
            current_path: request.current_path,
            link_targets,
            max_depth: request.max_depth.unwrap_or(DEFAULT_MAX_DEPTH),
            sheet_literal_cache: HashMap::new(),
            timezone: request.timezone.unwrap_or_else(|| "UTC".to_string()),
        }
    }

    fn resolve_current_sheet(
        &mut self,
    ) -> Result<ResolveSheetExternalFormulaInputsResponse, String> {
        let content = self
            .content_by_path
            .get(&self.current_path)
            .cloned()
            .ok_or_else(|| "Current sheet content is missing".to_string())?;
        let rows = parse_sheet_rows(SheetText::new(&content));
        let mut inputs = Vec::new();

        for (row_index, row) in rows.iter().enumerate() {
            for (column_index, value) in row.iter().enumerate() {
                let source = parse_sheet_markdown_cell_value(SheetText::new(value));
                if !is_external_formula_input(SheetText::new(&source)) {
                    continue;
                }

                let mut stack = ResolveStack::new(&self.current_path);
                if let Some(evaluated) = self.resolve_external_formula_input(
                    &source,
                    &self.current_path.clone(),
                    &mut stack,
                )? {
                    inputs.push(ResolvedSheetExternalFormulaInput {
                        cell: cell_address(row_index + 1, column_index + 1),
                        evaluated,
                        source,
                    });
                }
            }
        }

        Ok(ResolveSheetExternalFormulaInputsResponse { inputs })
    }

    fn resolve_external_formula_input(
        &mut self,
        value: &str,
        source_path: &str,
        stack: &mut ResolveStack,
    ) -> Result<Option<String>, String> {
        if !is_external_formula_input(SheetText::new(value)) {
            return Ok(None);
        }

        let mut fully_resolved = true;
        let evaluated = external_ref_regex()
            .replace_all(value, |captures: &regex::Captures<'_>| {
                let reference = ExternalReference::from_captures(captures);
                match self.resolve_external_reference(&reference, source_path, stack) {
                    Some(literal) => literal,
                    None => {
                        fully_resolved = false;
                        reference.raw.to_string()
                    }
                }
            })
            .to_string();

        if !fully_resolved || evaluated == value {
            Ok(None)
        } else {
            Ok(Some(evaluated))
        }
    }

    fn resolve_external_reference(
        &mut self,
        reference: &ExternalReference<'_>,
        source_path: &str,
        stack: &mut ResolveStack,
    ) -> Option<String> {
        let target_path = self
            .link_targets
            .get(&link_key(
                SheetText::new(source_path),
                SheetText::new(&reference.target),
            ))?
            .clone();
        if target_path == source_path {
            return Some(reference.local_cell_reference());
        }

        let address = reference.address()?;
        self.resolve_external_cell_literal(&target_path, &address, stack)
            .ok()
            .flatten()
    }

    fn resolve_external_cell_literal(
        &mut self,
        path: &str,
        address: &str,
        stack: &mut ResolveStack,
    ) -> Result<Option<String>, String> {
        if !stack.can_enter(path, self.max_depth) {
            return Ok(None);
        }

        if let Some(cached_sheet) = self.sheet_literal_cache.get(path) {
            return Ok(cached_sheet.get(address).cloned());
        }

        let Some(content) = self.content_by_path.get(path).cloned() else {
            return Ok(None);
        };

        stack.enter(path);
        let result = self.build_sheet_literal_cache(path, &content, stack);
        stack.exit(path);
        result?;

        Ok(self
            .sheet_literal_cache
            .get(path)
            .and_then(|sheet| sheet.get(address).cloned()))
    }

    fn build_sheet_literal_cache(
        &mut self,
        path: &str,
        content: &str,
        stack: &mut ResolveStack,
    ) -> Result<(), String> {
        let rows = parse_sheet_rows(SheetText::new(content));
        let workbook_name = workbook_name_from_path(SheetText::new(path));
        let timezone = self.timezone.clone();
        let mut model = Model::new_empty(workbook_name.as_str(), "en", timezone.as_str(), "en")?;

        let sheet_rows = SheetRows { path, rows: &rows };
        let build_inputs = self.populate_model_from_rows(&mut model, &sheet_rows, stack)?;
        model.evaluate();
        self.sheet_literal_cache.insert(
            path.to_string(),
            collect_sheet_literals(&model, &rows, &build_inputs),
        );
        Ok(())
    }

    fn populate_model_from_rows(
        &mut self,
        model: &mut Model<'_>,
        sheet_rows: &SheetRows<'_>,
        stack: &mut ResolveStack,
    ) -> Result<SheetBuildInputs, String> {
        let mut external_inputs = HashMap::<String, String>::new();
        let mut unresolved_external_cells = HashSet::<String>::new();

        for (row_index, row) in sheet_rows.rows.iter().enumerate() {
            for (column_index, value) in row.iter().enumerate() {
                let source = parse_sheet_markdown_cell_value(SheetText::new(value));
                if source.is_empty() {
                    continue;
                }

                let address = cell_address(row_index + 1, column_index + 1);
                let model_input =
                    match self.resolve_external_formula_input(&source, sheet_rows.path, stack)? {
                        Some(evaluated) => {
                            external_inputs.insert(address, evaluated.clone());
                            evaluated
                        }
                        None => {
                            if is_external_formula_input(SheetText::new(&source)) {
                                unresolved_external_cells.insert(address);
                            }
                            source
                        }
                    };

                model.set_user_input(
                    SHEET_INDEX,
                    row_index as i32 + 1,
                    column_index as i32 + 1,
                    model_input,
                )?;
            }
        }

        Ok(SheetBuildInputs {
            external_inputs,
            unresolved_external_cells,
        })
    }
}

fn collect_sheet_literals(
    model: &Model<'_>,
    rows: &[Vec<String>],
    build_inputs: &SheetBuildInputs,
) -> HashMap<String, String> {
    let mut literals = HashMap::new();
    for (row_index, row) in rows.iter().enumerate() {
        collect_sheet_row_literals(model, row_index, row, build_inputs, &mut literals);
    }
    literals
}

fn collect_sheet_row_literals(
    model: &Model<'_>,
    row_index: usize,
    row: &[String],
    build_inputs: &SheetBuildInputs,
    literals: &mut HashMap<String, String>,
) {
    for (column_index, _value) in row.iter().enumerate() {
        let row_number = row_index as i32 + 1;
        let column_number = column_index as i32 + 1;
        let address = cell_address(row_index + 1, column_index + 1);
        if build_inputs.unresolved_external_cells.contains(&address) {
            continue;
        }
        let content = build_inputs
            .external_inputs
            .get(&address)
            .cloned()
            .unwrap_or_else(|| {
                model
                    .get_localized_cell_content(SHEET_INDEX, row_number, column_number)
                    .unwrap_or_default()
            });
        literals.insert(
            address,
            external_cell_formula_literal(
                model,
                row_number,
                column_number,
                SheetText::new(&content),
            ),
        );
    }
}

#[cfg(test)]
#[path = "sheet_tests.rs"]
mod tests;
