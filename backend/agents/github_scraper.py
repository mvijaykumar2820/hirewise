"""GitHub profile scraper using Bright Data and GitHub public API."""
import os
import httpx

BRIGHTDATA_API_KEY = os.getenv("BRIGHT_DATA_API_KEY", "")

async def scrape_github_profile(github_url: str) -> dict:
    """
    Scrape a GitHub user's profile data: repos, languages, stars, contributions.
    Uses Bright Data proxy for reliable access, falls back to direct GitHub API.
    """
    # Extract username from URL
    username = github_url.rstrip("/").split("/")[-1]
    if not username:
        return {"error": "Invalid GitHub URL"}
    
    # Bright Data proxy config
    proxy_url = None
    if BRIGHTDATA_API_KEY:
        proxy_url = f"http://brd-customer-hl_1807dfc2-zone-scraping_browser1:{BRIGHTDATA_API_KEY}@brd.superproxy.io:33335"
    
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=30, verify=False) as client:
            # 1. Get user profile
            profile_res = await client.get(f"https://api.github.com/users/{username}")
            if profile_res.status_code != 200:
                # Fallback: try without proxy
                async with httpx.AsyncClient(timeout=15) as fallback:
                    profile_res = await fallback.get(f"https://api.github.com/users/{username}")
            
            profile = profile_res.json() if profile_res.status_code == 200 else {}
            
            # 2. Get repos (sorted by recent updates)
            repos_res = await client.get(
                f"https://api.github.com/users/{username}/repos?sort=updated&per_page=15"
            )
            if repos_res.status_code != 200:
                async with httpx.AsyncClient(timeout=15) as fallback:
                    repos_res = await fallback.get(f"https://api.github.com/users/{username}/repos?sort=updated&per_page=15")
            
            repos = repos_res.json() if repos_res.status_code == 200 else []
    except Exception as e:
        print(f"Bright Data proxy failed: {e}. Falling back to direct API...")
        # Complete fallback without proxy
        async with httpx.AsyncClient(timeout=15) as client:
            profile_res = await client.get(f"https://api.github.com/users/{username}")
            profile = profile_res.json() if profile_res.status_code == 200 else {}
            repos_res = await client.get(f"https://api.github.com/users/{username}/repos?sort=updated&per_page=15")
            repos = repos_res.json() if repos_res.status_code == 200 else []
    
    if not profile or "login" not in profile:
        return {"error": f"GitHub user '{username}' not found", "username": username}
    
    # Parse repo data
    parsed_repos = []
    all_languages = {}
    total_stars = 0
    
    for repo in repos:
        if isinstance(repo, dict) and not repo.get("fork", False):
            lang = repo.get("language", "Unknown") or "Unknown"
            stars = repo.get("stargazers_count", 0)
            total_stars += stars
            
            if lang != "Unknown":
                all_languages[lang] = all_languages.get(lang, 0) + 1
            
            parsed_repos.append({
                "name": repo.get("name", ""),
                "description": repo.get("description", "") or "No description",
                "language": lang,
                "stars": stars,
                "forks": repo.get("forks_count", 0),
                "updated_at": repo.get("updated_at", ""),
                "url": repo.get("html_url", ""),
            })
    
    # Sort languages by frequency
    sorted_languages = sorted(all_languages.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "username": profile.get("login", username),
        "name": profile.get("name", ""),
        "bio": profile.get("bio", "") or "",
        "public_repos": profile.get("public_repos", 0),
        "followers": profile.get("followers", 0),
        "following": profile.get("following", 0),
        "created_at": profile.get("created_at", ""),
        "avatar_url": profile.get("avatar_url", ""),
        "total_stars": total_stars,
        "top_languages": [lang for lang, _ in sorted_languages[:6]],
        "language_breakdown": dict(sorted_languages),
        "repos": parsed_repos[:10],  # Top 10 repos
        "profile_url": f"https://github.com/{username}",
    }


def format_github_for_ai(github_data: dict) -> str:
    """Format GitHub data into readable text for AI analysis."""
    if "error" in github_data:
        return f"GitHub Profile: Not found or invalid ({github_data.get('error')})"
    
    lines = [
        f"=== GITHUB PROFILE: @{github_data['username']} ===",
        f"Name: {github_data.get('name', 'N/A')}",
        f"Bio: {github_data.get('bio', 'No bio')}",
        f"Public Repos: {github_data['public_repos']}",
        f"Followers: {github_data['followers']} | Following: {github_data['following']}",
        f"Total Stars: {github_data['total_stars']}",
        f"Account Created: {github_data.get('created_at', 'N/A')[:10]}",
        f"Top Languages: {', '.join(github_data.get('top_languages', ['None']))}",
        f"Language Distribution: {github_data.get('language_breakdown', {})}",
        "",
        "--- TOP REPOSITORIES ---",
    ]
    
    for repo in github_data.get("repos", []):
        lines.append(f"• {repo['name']} [{repo['language']}] ★{repo['stars']} — {repo['description'][:80]}")
    
    return "\n".join(lines)
