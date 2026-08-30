# Project Instructions

## Project

`pixiv-file-manager` is a Windows desktop application for organizing image files downloaded from Pixiv. It retrieves illustration metadata through the unofficial Pixiv API, stores the metadata in SQLite, and lets the user search, classify, move, delete, and synchronize local files.

The current application consists of:

* a React + TypeScript frontend;
* a Rust backend running on Tauri;
* SQLite persistence; and
* Windows-only packaging and release automation.

The main user-facing areas are tag fetching, tag search, file organization, tag management, and settings. Preserve the existing behavior around Pixiv identifiers, suffixes, management numbers (`cnum`), series, characters, authors, local paths, and database synchronization unless the relevant design or Issue explicitly changes it.

The application may communicate with Pixiv and must handle refresh tokens and local paths as sensitive data. The application/runtime must not depend on external AI APIs. Keep databases, downloaded images, credentials, logs, build artifacts, and other machine-specific data outside the repository unless a test fixture explicitly requires a small synthetic file.

## Sources of Truth

Use these authorities in order:

1. `README.md` — product purpose, supported platform, user-facing features, and technology stack.
2. `docs/app_design.md` — functional behavior and screen-level workflows.
3. `docs/db_design.md` — SQLite tables, columns, keys, and data relationships.
4. `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `.github/workflows/` — build, dependency, version, and release configuration.
5. GitHub Issues and Milestones — work state, acceptance criteria, and roadmap metadata.

`docs/todo.md` is a legacy backlog being migrated to GitHub Issues. Do not add to or update it. Delete it only after every current item has been represented by a verified GitHub Issue. Do not recreate a local TODO or ROADMAP as a fallback when GitHub is unavailable.

If these sources conflict, prefer the higher item and record a design decision in an Issue before changing behavior. `docs/` design documents describe the intended application contract; implementation details must not silently redefine that contract.

## Work Units

Treat one user-requested purpose as one work unit, including its required implementation, documentation, tests, and verification.

* Before editing, inspect the relevant source of truth, existing implementation, tests, current Git status, and the applicable GitHub Issue.
* Preserve unrelated existing changes. Stage and commit only files belonging to the current work unit.
* Keep frontend, Rust/Tauri, database, and workflow changes together only when they are required for the same user-visible purpose.
* Treat physical file moves and deletions, database record deletion, token handling, and path changes as side-effecting operations. Document their confirmation, rollback, or failure behavior and test them where practical.
* Do not commit user images, databases, credentials, generated bundles, `target/`, or other machine-specific artifacts.

For implementation work, use the `github-issue-workflow` skill. Use `intent-first-safe-change` when changing code, files, configuration, tests, or documentation. Use `grilling` when a plan or design still has meaningful unresolved decisions.

## Issue and Backlog Policy

GitHub Issues are the backlog and operational checkpoint. Do not maintain a parallel Markdown task list.

IssueとPRのタイトル・本文・checkpointは原則として日本語で書く。英語のままにしてよいのは、技術名、コマンド、ファイルパス、ブランチ名、GitHubの固定フィールド名（`State`、`Owner`、`Next action`など）と、誤解を避けるために必要な固有名詞だけとする。

Issue titles do not require artificial Phase numbers. Use a short Japanese type prefix when creating a new Issue:

* `機能: <機能名>`
* `不具合: <直す挙動>`
* `保守: <保守内容>`
* `更新: <更新対象>`
* `判断: <方針・設計判断>`

Use one Issue for one independently reviewable work unit. A long-running upgrade may have one parent `更新:` Issue and component-specific child Issues. The Issue body, not its title or comments, is the current-state checkpoint.

The five items formerly listed in `docs/todo.md` must be migrated as individual Issues. Their current text is:

* management-number handling and suffix selection for file moves;
* the series aggregation bug;
* the Manage execution bug;
* an option to skip deletion confirmation; and
* ascending/descending sort order.

Only after those Issues are created and checked against the source list may `docs/todo.md` be removed. If GitHub access or mutation fails, report the exact failure, do not guess Issue state, and leave the legacy file in place until migration can be verified.

## Git and Branches

The normal workflow is GitHub Flow:

1. Start from the latest `main`.
2. Create one short-lived branch for one Issue and one purpose.
3. Use a type and lowercase hyphenated purpose: `feat/`, `fix/`, `docs/`, `test/`, `refactor/`, or `chore/`.
4. Open a pull request into `main` after verification.
5. Merge and delete the branch only with the required human approval.

Do not commit directly to `main`. Do not create or maintain a permanent `develop`, phase, or release-integration branch.

During the planned major-version-upgrade period, a temporary integration branch is allowed:

* create `chore/major-version-upgrade` from `main` for the upgrade parent Issue;
* allow component branches to target that temporary branch when independent PRs must be integrated before the final upgrade review;
* keep the temporary branch limited to the upgrade scope and checkpoint it in the parent Issue; and
* after the full verification gate, open the final PR into `main` and remove the temporary branch after merge.

The existing `develop` branch is historical state, not a reason to establish a permanent branch policy. Never switch branches while unrelated uncommitted changes exist; finish, preserve, or explicitly hand off those changes first.

The application currently has version declarations in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. A major version upgrade or release must update these declarations consistently and verify the resulting package metadata. The current mismatch is pre-existing and belongs to the upgrade work, not to unrelated feature changes.

## Verification

Before declaring a work unit complete:

* run the most targeted relevant tests or checks first;
* run `pnpm build` for frontend and TypeScript changes;
* run `cargo check` or `pnpm tauri build` for Rust/Tauri changes when the native toolchain and dependencies are available;
* run `git diff --check`;
* review targeted status and diff; and
* verify the applicable Issue acceptance criteria and external side effects.

If a check cannot run, state what was not run and why. Do not claim precision, safety, or release readiness from structural checks alone.

## Commits and Delivery

After successful verification, automatically commit the completed work unit when the current branch is not `main` or `master`, using:

`<type>: <short purpose>`

Allowed types are `feat`, `fix`, `docs`, `test`, `refactor`, and `chore`.

Do not push, merge, close an Issue, or publish a release without explicit approval where the workflow requires it. If local changes are verified but delivery is pending, keep the Issue in `REVIEW` or `IN_PROGRESS` with a concrete next action.

## Reporting

Every final report after performing work must contain:

1. **Result** — what was accomplished.
2. **Changes** — absolute paths and the purpose of each changed file/component.
3. **Verification** — checks actually run and their results.
4. **Remaining** — incomplete, uncertain, blocked, or intentionally deferred work.
5. **Next** — the concrete next action when work remains.

Distinguish facts from assumptions. Report Issue and Milestone state only after a fresh GitHub query. If GitHub access, Issue mutation, commit, or required verification fails, report that failure explicitly and do not treat the work unit as complete.
