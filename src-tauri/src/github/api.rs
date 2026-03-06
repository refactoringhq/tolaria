use super::{GitHubUser, GithubRepo};

/// Lists the authenticated user's GitHub repositories.
pub async fn github_list_repos(token: &str) -> Result<Vec<GithubRepo>, String> {
    github_list_repos_with_base(token, "https://api.github.com").await
}

async fn github_list_repos_with_base(
    token: &str,
    api_base: &str,
) -> Result<Vec<GithubRepo>, String> {
    let client = reqwest::Client::new();
    let mut all_repos: Vec<GithubRepo> = Vec::new();
    let mut page = 1u32;

    loop {
        let url = format!(
            "{}/user/repos?per_page=100&sort=updated&page={}",
            api_base, page
        );
        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Laputa-App")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| format!("GitHub API request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API error {}: {}", status, body));
        }

        let repos: Vec<GithubRepo> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

        let count = repos.len();
        all_repos.extend(repos);

        if count < 100 {
            break;
        }
        page += 1;
        if page > 10 {
            break; // safety limit: 1000 repos max
        }
    }

    Ok(all_repos)
}

/// Creates a new GitHub repository for the authenticated user.
pub async fn github_create_repo(
    token: &str,
    name: &str,
    private: bool,
) -> Result<GithubRepo, String> {
    github_create_repo_with_base(token, name, private, "https://api.github.com").await
}

async fn github_create_repo_with_base(
    token: &str,
    name: &str,
    private: bool,
    api_base: &str,
) -> Result<GithubRepo, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "name": name,
        "private": private,
        "auto_init": true,
        "description": "Laputa vault"
    });

    let response = client
        .post(format!("{}/user/repos", api_base))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Laputa-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if status.as_u16() == 422 && body.contains("name already exists") {
            return Err("Repository name already exists on your account".to_string());
        }
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    response
        .json::<GithubRepo>()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))
}

/// Gets the authenticated GitHub user's profile.
pub async fn github_get_user(token: &str) -> Result<GitHubUser, String> {
    github_get_user_with_base(token, "https://api.github.com").await
}

async fn github_get_user_with_base(token: &str, api_base: &str) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/user", api_base))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Laputa-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("GitHub user request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    response
        .json::<GitHubUser>()
        .await
        .map_err(|e| format!("Failed to parse user response: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn mock_json(
        method: &str,
        path: &str,
        status: usize,
        body: &str,
    ) -> (mockito::ServerGuard, mockito::Mock) {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock(method, path)
            .with_status(status)
            .with_header("content-type", "application/json")
            .with_body(body)
            .create_async()
            .await;
        (server, mock)
    }

    async fn mock_list_repos(status: usize, body: &str) -> Result<Vec<GithubRepo>, String> {
        let (server, mock) = mock_json(
            "GET",
            "/user/repos?per_page=100&sort=updated&page=1",
            status,
            body,
        )
        .await;
        let result = github_list_repos_with_base("token", &server.url()).await;
        mock.assert_async().await;
        result
    }

    async fn mock_create_repo(status: usize, body: &str) -> Result<GithubRepo, String> {
        let (server, mock) = mock_json("POST", "/user/repos", status, body).await;
        let result = github_create_repo_with_base("token", "repo", false, &server.url()).await;
        mock.assert_async().await;
        result
    }

    async fn mock_user(status: usize, body: &str) -> Result<GitHubUser, String> {
        let (server, mock) = mock_json("GET", "/user", status, body).await;
        let result = github_get_user_with_base("token", &server.url()).await;
        mock.assert_async().await;
        result
    }

    #[tokio::test]
    async fn test_github_list_repos_success() {
        let repos = mock_list_repos(
            200,
            r#"[{"name":"my-repo","full_name":"user/my-repo","description":"A repo","private":false,"clone_url":"https://github.com/user/my-repo.git","html_url":"https://github.com/user/my-repo","updated_at":"2026-02-01T00:00:00Z"}]"#,
        )
        .await
        .unwrap();

        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0].name, "my-repo");
    }

    #[tokio::test]
    async fn test_github_list_repos_empty() {
        let repos = mock_list_repos(200, "[]").await.unwrap();
        assert!(repos.is_empty());
    }

    #[tokio::test]
    async fn test_github_list_repos_auth_error() {
        let err = mock_list_repos(401, r#"{"message":"Bad credentials"}"#)
            .await
            .unwrap_err();
        assert!(err.contains("GitHub API error"));
    }

    #[tokio::test]
    async fn test_github_list_repos_paginated() {
        let mut server = mockito::Server::new_async().await;

        let repos_page1: Vec<serde_json::Value> = (0..100)
            .map(|i| {
                serde_json::json!({
                    "name": format!("repo-{}", i),
                    "full_name": format!("user/repo-{}", i),
                    "description": null,
                    "private": false,
                    "clone_url": format!("https://github.com/user/repo-{}.git", i),
                    "html_url": format!("https://github.com/user/repo-{}", i),
                    "updated_at": null
                })
            })
            .collect();

        let mock1 = server
            .mock("GET", "/user/repos?per_page=100&sort=updated&page=1")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(serde_json::to_string(&repos_page1).unwrap())
            .create_async()
            .await;
        let mock2 = server
            .mock("GET", "/user/repos?per_page=100&sort=updated&page=2")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"[{"name":"extra-repo","full_name":"user/extra-repo","description":null,"private":true,"clone_url":"https://github.com/user/extra-repo.git","html_url":"https://github.com/user/extra-repo","updated_at":null}]"#,
            )
            .create_async()
            .await;

        let repos = github_list_repos_with_base("token", &server.url())
            .await
            .unwrap();
        mock1.assert_async().await;
        mock2.assert_async().await;

        assert_eq!(repos.len(), 101);
        assert_eq!(repos[100].name, "extra-repo");
    }

    #[tokio::test]
    async fn test_github_create_repo_success() {
        let repo = mock_create_repo(
            201,
            r#"{"name":"new-repo","full_name":"user/new-repo","description":"Laputa vault","private":true,"clone_url":"https://github.com/user/new-repo.git","html_url":"https://github.com/user/new-repo","updated_at":"2026-02-01T00:00:00Z"}"#,
        )
        .await
        .unwrap();

        assert_eq!(repo.name, "new-repo");
        assert!(repo.private);
    }

    #[tokio::test]
    async fn test_github_create_repo_name_exists() {
        let err = mock_create_repo(
            422,
            r#"{"message":"Validation Failed","errors":[{"resource":"Repository","code":"custom","field":"name","message":"name already exists on this account"}]}"#,
        )
        .await
        .unwrap_err();
        assert!(err.contains("Repository name already exists"));
    }

    #[tokio::test]
    async fn test_github_create_repo_server_error() {
        let err = mock_create_repo(500, r#"{"message":"Internal Server Error"}"#)
            .await
            .unwrap_err();
        assert!(err.contains("GitHub API error 500"));
    }

    #[tokio::test]
    async fn test_github_get_user_success() {
        let user = mock_user(
            200,
            r#"{"login":"lucaong","name":"Luca Ongaro","avatar_url":"https://avatars.githubusercontent.com/u/12345"}"#,
        )
        .await
        .unwrap();

        assert_eq!(
            user,
            GitHubUser {
                login: "lucaong".to_string(),
                name: Some("Luca Ongaro".to_string()),
                avatar_url: "https://avatars.githubusercontent.com/u/12345".to_string(),
            }
        );
    }

    #[tokio::test]
    async fn test_github_get_user_unauthorized() {
        let err = mock_user(401, r#"{"message":"Bad credentials"}"#)
            .await
            .unwrap_err();
        assert!(err.contains("GitHub API error 401"));
    }

    #[tokio::test]
    async fn test_github_get_user_null_name() {
        let user = mock_user(
            200,
            r#"{"login":"bot-account","name":null,"avatar_url":"https://avatars.githubusercontent.com/u/99"}"#,
        )
        .await
        .unwrap();

        assert_eq!(user.login, "bot-account");
        assert!(user.name.is_none());
    }
}
