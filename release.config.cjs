const { execSync } = require("node:child_process");

/**
 * semantic-release prefers `package.json` `repository.url` over `git remote` by default.
 * Anonymous `git ls-remote` to HTTPS then fails for private GitHub repos ("Repository not found").
 * Prefer `origin` when set (often SSH), or `SEMANTIC_RELEASE_REPOSITORY_URL` for overrides.
 */
function getRepositoryUrl() {
  const fromEnv = process.env.SEMANTIC_RELEASE_REPOSITORY_URL;
  if (fromEnv) return fromEnv;
  try {
    const origin = execSync("git config --get remote.origin.url", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return origin || undefined;
  } catch {
    return undefined;
  }
}

const repositoryUrl = getRepositoryUrl();

/**
 * @type {import('semantic-release').Options}
 */
module.exports = {
  branches: [
    "main",
    { name: "beta", channel: "beta", prerelease: "beta" },
  ],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "angular",
        // Custom rules run first; unmatched commits still use the plugin defaults (feat/fix/perf, etc.).
        releaseRules: [{ type: "docs", release: "patch" }],
      },
    ],
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/npm",
      {
        // true after npm Trusted Publisher (OIDC); CI maps repo secret NPM_SECRET to env NPM_TOKEN.
        provenance: false,
      },
    ],
    "@semantic-release/github",
  ],
  ...(repositoryUrl ? { repositoryUrl } : {}),
};
