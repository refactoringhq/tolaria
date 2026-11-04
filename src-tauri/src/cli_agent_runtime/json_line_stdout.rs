use std::io::BufRead;

pub(super) struct JsonLineStdout {
    pub(super) session_id: String,
    pub(super) ignored_stdout_lines: Vec<String>,
    pub(super) parsed_json_lines: usize,
}

pub(super) fn consume_json_line_stdout<Event, F, H>(
    reader: impl BufRead,
    emit: &mut F,
    error_event: impl Fn(String) -> Event,
    handle_json: &mut H,
) -> JsonLineStdout
where
    F: FnMut(Event),
    H: FnMut(&serde_json::Value, &mut F, &mut String),
{
    let mut output = JsonLineStdout {
        session_id: String::new(),
        ignored_stdout_lines: Vec::new(),
        parsed_json_lines: 0,
    };

    for line in reader.lines() {
        match parse_process_stdout_line(line, &mut output.ignored_stdout_lines) {
            Ok(Some(json)) => {
                output.parsed_json_lines += 1;
                handle_json(&json, emit, &mut output.session_id);
            }
            Ok(None) => {}
            Err(message) => {
                emit(error_event(message));
                break;
            }
        }
    }

    output
}

fn parse_process_stdout_line(
    line: Result<String, std::io::Error>,
    ignored_stdout_lines: &mut Vec<String>,
) -> Result<Option<serde_json::Value>, String> {
    let line = line.map_err(|error| format!("Read error: {error}"))?;
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    match serde_json::from_str::<serde_json::Value>(trimmed) {
        Ok(json) => Ok(Some(json)),
        Err(_) => {
            push_ignored_stdout_line(ignored_stdout_lines, trimmed);
            Ok(None)
        }
    }
}

fn push_ignored_stdout_line(lines: &mut Vec<String>, line: &str) {
    if lines.len() < 3 {
        lines.push(line.to_string());
    }
}
