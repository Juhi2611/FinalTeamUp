// githubLanguageService.ts
export async function fetchRepoLanguages(
  repos: any[],
  token: string
): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};

  for (const repo of repos) {
    if (repo.fork) continue;

    const res = await fetch(repo.languages_url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) continue;

    const data: Record<string, number> = await res.json();

    for (const [lang, bytes] of Object.entries(data)) {
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }

  return totals;
}

export async function calculateLanguageUsage(languageBytes: Record<string, number>) {
  const totalBytes = Object.values(languageBytes).reduce((a, b) => a + b, 0);

  return Object.entries(languageBytes)
    .map(([language, bytes]) => ({
      language,
      bytes,
      percent: Math.round((bytes / totalBytes) * 100),
    }))
    .sort((a, b) => b.percent - a.percent);
}

