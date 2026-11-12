# AGENTS.md — Rules for any AI coding agent working in this repository

Read this file fully before doing anything. These rules apply to every task, in both backend and frontend repositories.

## 1. NEVER DELETE ANYTHING (most important rule)
- Do NOT delete, rename, move, or empty any file or folder. Every existing file is intentional and correct, even if it looks unused, duplicated, old, or broken.
- Do NOT "clean up", "reorganize", "simplify the project structure", or "remove unused files/code".
- If you think a file or block of code is unnecessary, mention it in your reply and leave it exactly where it is.

## 2. Edit only what I ask for
- Change only the lines needed for the current request. Leave everything else exactly as it is.
- Never rewrite a whole file when a small edit is enough.
- Never replace existing code with placeholders or shortened versions (for example "// ... rest of the code unchanged"). Existing code must stay in full.
- Do not remove existing features, routes, functions, comments, or settings unless I name them explicitly.
- Do not refactor, rename variables or functions, or reformat code that is unrelated to the request.

## 3. Do not touch configuration or secrets unless I ask
- Leave these alone: package.json, lock files, tsconfig, vite config, capacitor.config, wrangler.toml / wrangler.jsonc (bindings, D1 database IDs, routes, vars), migrations/, schema.sql, .gitignore, android/ and ios/ folders, public/ assets.
- Never print, hard-code, or commit API keys or secrets. Secrets stay in environment variables.
- Do not add or upgrade dependencies without asking me first.

## 4. Keep frontend and backend compatible
- Do not change API endpoints, request/response field names, WebSocket message formats, or database table/column names unless I ask. The frontend and backend depend on each other.

## 5. Working method
- Read the whole file you are about to edit, and match its existing style.
- If a request seems to require deleting or fully rewriting something, stop and ask me first.
- After finishing, give a short list: which files you changed and what changed, plus anything you noticed but did not change.
- I am a non-technical founder. Keep explanations short and simple.
