# Contributing to GigLedger

Thank you for contributing to GigLedger, an OpenForge-Labs project.

## Getting Started

1. Fork [OpenForge-Labs/GigLedger](https://github.com/OpenForge-Labs/GigLedger) on GitHub.
2. Clone the repository and enter the project directory:

   ```bash
   git clone https://github.com/OpenForge-Labs/GigLedger.git
   cd GigLedger
   ```

3. The default branch is `main`. Create a focused feature branch from it:

   ```bash
   git switch main
   git switch -c feature/short-description
   ```

4. If you are working from a fork, configure your fork's GitHub-provided remote as `origin` and keep `https://github.com/OpenForge-Labs/GigLedger.git` as `upstream`.

## Local Development

From the repository root, copy the safe environment template and install dependencies:

```bash
Copy-Item .env.example server/.env
npm install
npm run db:generate
npm run db:migrate
npm run server:dev
```

The frontend development command is:

```bash
npm run dev
```

Before running the database commands, configure a local PostgreSQL connection in `server/.env`. The API runs on the configured server port, and the frontend runs with Vite. Never commit that environment file.

## Checks

Run the available validation commands before opening a pull request:

```bash
npm run lint
npm run build
node scripts/checklist.mjs
npm run db:generate
```

There is currently no automated server test script in the project. When changing API or database behavior, run the available Prisma generation check and manually verify the affected behavior locally.

## Code and Data Safety

- Keep changes focused and consistent with the existing JavaScript, React, Vite, Express, and Prisma patterns.
- Add or update tests and checklist coverage for behavior changes.
- Preserve local-first behavior unless a change explicitly requires otherwise.
- Do not commit `.env` files, secrets, API keys, passwords, tokens, personal credentials, `node_modules`, build artifacts, or local database files.
- Do not include real user data in issues, pull requests, tests, screenshots, or logs.

## Commits

Make small, purposeful commits with concise imperative messages, for example:

```text
Improve import validation
```

Keep unrelated changes in separate commits.

## Pull Requests

All changes go through pull requests. Follow this workflow: fork the repository, clone it, create a branch from `main`, make changes, run the relevant checks, commit your changes, push your branch to your fork, and open a pull request against [OpenForge-Labs/GigLedger](https://github.com/OpenForge-Labs/GigLedger). Explain what changed, why it is needed, and how it was tested. Include screenshots for user-interface changes and call out any migration, compatibility, or security considerations.

Pull requests should be reviewable, pass the applicable checks, and address reviewer feedback before merging. Do not merge directly to the default branch.
