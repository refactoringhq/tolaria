use super::views::{evaluate_view, FilterGroup, ViewDefinition};
use super::VaultEntry;

#[derive(serde::Deserialize)]
struct ArchivedFilterContract {
    fixtures: Vec<ArchivedFilterFixture>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchivedFilterFixture {
    name: String,
    filters: FilterGroup,
    entries: Vec<ArchivedFilterEntry>,
    expected_titles: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchivedFilterEntry {
    title: String,
    is_a: Option<String>,
    archived: bool,
}

fn fixture_entry(entry: ArchivedFilterEntry) -> VaultEntry {
    VaultEntry {
        title: entry.title,
        is_a: entry.is_a,
        archived: entry.archived,
        ..VaultEntry::default()
    }
}

#[test]
fn evaluate_archived_entry_policy_matches_shared_contract() {
    let contract: ArchivedFilterContract = serde_json::from_str(include_str!(
        "../../../src/shared/viewFilterArchivedContract.json"
    ))
    .expect("shared archived-filter contract must be valid JSON");

    for fixture in contract.fixtures {
        let ArchivedFilterFixture {
            name,
            filters,
            entries: fixture_entries,
            expected_titles,
        } = fixture;
        let entries = fixture_entries
            .into_iter()
            .map(fixture_entry)
            .collect::<Vec<_>>();
        let definition = ViewDefinition {
            name: name.clone(),
            icon: None,
            color: None,
            order: None,
            sort: None,
            list_properties_display: Vec::new(),
            filters,
        };
        let matching_titles = evaluate_view(&definition, &entries)
            .into_iter()
            .map(|index| entries[index].title.clone())
            .collect::<Vec<_>>();

        assert_eq!(matching_titles, expected_titles, "fixture: {name}");
    }
}
