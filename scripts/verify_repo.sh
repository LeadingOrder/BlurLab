#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILURES=0
WARNINGS=0

print_pass() {
    printf "\033[32m✓\033[0m %s\n" "$1"
}

print_fail() {
    printf "\033[31m✗\033[0m %s\n" "$1"
    FAILURES=$((FAILURES + 1))
}

print_warning() {
    printf "\033[33m!\033[0m %s\n" "$1"
    WARNINGS=$((WARNINGS + 1))
}

print_section() {
    printf "\n\033[1m%s\033[0m\n" "$1"
}

require_command() {
    if command -v "$1" >/dev/null 2>&1; then
        print_pass "Command available: $1"
    else
        print_fail "Missing command: $1"
    fi
}

require_file() {
    if [ -f "$1" ]; then
        print_pass "File exists: $1"
    else
        print_fail "Missing file: $1"
    fi
}

require_directory() {
    if [ -d "$1" ]; then
        print_pass "Directory exists: $1"
    else
        print_fail "Missing directory: $1"
    fi
}

read_json_field() {
    local file="$1"
    local field="$2"

    node -e '
        const fs = require("fs");

        const file = process.argv[1];
        const field = process.argv[2];
        const document = JSON.parse(fs.readFileSync(file, "utf8"));

        const value = field
            .split(".")
            .reduce((current, key) => current?.[key], document);

        if (value !== undefined && value !== null) {
            process.stdout.write(String(value));
        }
    ' "$file" "$field"
}

print_section "Repository"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    print_pass "Current directory is a Git repository"
else
    print_fail "Current directory is not a Git repository"
fi

ROOT_PACKAGE_NAME="$(read_json_field package.json name 2>/dev/null || true)"

if [ "$ROOT_PACKAGE_NAME" = "blurlab" ]; then
    print_pass "Root package name is blurlab"
else
    print_fail "Expected root package name blurlab, found: ${ROOT_PACKAGE_NAME:-missing}"
fi

ROOT_PRIVATE="$(read_json_field package.json private 2>/dev/null || true)"

if [ "$ROOT_PRIVATE" = "true" ]; then
    print_pass "Root package is private"
else
    print_fail "Root package should be private"
fi

print_section "Required tools"

require_command git
require_command node
require_command pnpm

print_section "Runtime versions"

require_file .node-version

if command -v node >/dev/null 2>&1 && [ -f .node-version ]; then
    EXPECTED_NODE_VERSION="$(tr -d '[:space:]' <.node-version)"
    ACTUAL_NODE_VERSION="$(node -p 'process.versions.node')"

    if [ "$EXPECTED_NODE_VERSION" = "$ACTUAL_NODE_VERSION" ]; then
        print_pass "Node version matches .node-version: $ACTUAL_NODE_VERSION"
    else
        print_fail \
            "Node version mismatch: expected $EXPECTED_NODE_VERSION, found $ACTUAL_NODE_VERSION"
    fi
fi

PACKAGE_MANAGER="$(read_json_field package.json packageManager 2>/dev/null || true)"

if [ -n "$PACKAGE_MANAGER" ]; then
    print_pass "Package manager is pinned: $PACKAGE_MANAGER"
else
    print_fail "Root package.json has no packageManager field"
fi

if command -v pnpm >/dev/null 2>&1 && [ -n "$PACKAGE_MANAGER" ]; then
    EXPECTED_PNPM_VERSION="${PACKAGE_MANAGER#pnpm@}"
    EXPECTED_PNPM_VERSION="${EXPECTED_PNPM_VERSION%%+*}"
    ACTUAL_PNPM_VERSION="$(pnpm --version)"

    if [ "$EXPECTED_PNPM_VERSION" = "$ACTUAL_PNPM_VERSION" ]; then
        print_pass "pnpm version matches packageManager: $ACTUAL_PNPM_VERSION"
    else
        print_fail \
            "pnpm version mismatch: expected $EXPECTED_PNPM_VERSION, found $ACTUAL_PNPM_VERSION"
    fi
fi

print_section "Workspace structure"

require_file package.json
require_file pnpm-workspace.yaml
require_file pnpm-lock.yaml
require_file tsconfig.base.json
require_file .editorconfig
require_file .gitignore
require_file README.md

require_directory apps/web
require_directory apps/web/src
require_directory packages/engine/src
require_directory packages/design-system/src
require_directory docs/decisions
require_directory docs/video

require_file apps/web/package.json
require_file apps/web/vite.config.ts
require_file apps/web/src/main.tsx

require_file packages/engine/package.json
require_file packages/engine/src/index.ts

require_file packages/design-system/package.json
require_file packages/design-system/src/index.ts

require_file docs/video/footage-log.md

if grep -Eq 'apps/\*' pnpm-workspace.yaml; then
    print_pass "Workspace includes apps/*"
else
    print_fail "pnpm-workspace.yaml does not include apps/*"
fi

if grep -Eq 'packages/\*' pnpm-workspace.yaml; then
    print_pass "Workspace includes packages/*"
else
    print_fail "pnpm-workspace.yaml does not include packages/*"
fi

print_section "Workspace package metadata"

WEB_PACKAGE_NAME="$(read_json_field apps/web/package.json name 2>/dev/null || true)"
ENGINE_PACKAGE_NAME="$(
    read_json_field packages/engine/package.json name 2>/dev/null || true
)"
DESIGN_PACKAGE_NAME="$(
    read_json_field packages/design-system/package.json name 2>/dev/null || true
)"

if [ "$WEB_PACKAGE_NAME" = "@blurlab/web" ]; then
    print_pass "Web package is named @blurlab/web"
else
    print_fail "Expected web package @blurlab/web, found: ${WEB_PACKAGE_NAME:-missing}"
fi

if [ "$ENGINE_PACKAGE_NAME" = "@blurlab/engine" ]; then
    print_pass "Engine package is named @blurlab/engine"
else
    print_fail \
        "Expected engine package @blurlab/engine, found: ${ENGINE_PACKAGE_NAME:-missing}"
fi

if [ "$DESIGN_PACKAGE_NAME" = "@blurlab/design-system" ]; then
    print_pass "Design package is named @blurlab/design-system"
else
    print_fail \
        "Expected design package @blurlab/design-system, found: ${DESIGN_PACKAGE_NAME:-missing}"
fi

if pnpm -r list --depth -1 >/dev/null 2>&1; then
    print_pass "pnpm can resolve the workspace"
else
    print_fail "pnpm could not resolve the workspace"
fi

print_section "Lockfile integrity"

NESTED_LOCKFILES="$(
    find . \
        -name pnpm-lock.yaml \
        -not -path './pnpm-lock.yaml' \
        -not -path './node_modules/*' \
        -print
)"

if [ -z "$NESTED_LOCKFILES" ]; then
    print_pass "Only one pnpm lockfile exists"
else
    print_fail "Nested pnpm lockfiles found:"
    printf "%s\n" "$NESTED_LOCKFILES"
fi

print_section "Engine boundaries"

FORBIDDEN_ENGINE_IMPORTS="$(
    find packages/engine/src \
        -type f \
        \( -name '*.ts' -o -name '*.tsx' \) \
        -exec grep -nE \
        'from[[:space:]]+["'\''](react|react-dom|@mantine|@blurlab/design-system)' \
        {} + \
        2>/dev/null ||
        true
)"

if [ -z "$FORBIDDEN_ENGINE_IMPORTS" ]; then
    print_pass "Engine has no React, Mantine, or design-system imports"
else
    print_fail "Engine contains forbidden UI imports:"
    printf "%s\n" "$FORBIDDEN_ENGINE_IMPORTS"
fi

print_section "Generated scaffold"

if [ -f apps/web/public/vite.svg ] || [ -f apps/web/src/assets/react.svg ]; then
    print_warning "Default Vite assets are still present"
else
    print_pass "Default Vite assets have been removed"
fi

if grep -R -q "Vite + React" apps/web/src 2>/dev/null; then
    print_warning "Default Vite demonstration content is still present"
else
    print_pass "Default Vite demonstration content has been removed"
fi

print_section "Build"

if [ "${SKIP_BUILD:-0}" = "1" ]; then
    print_warning "Build verification skipped because SKIP_BUILD=1"
elif pnpm --filter @blurlab/web build; then
    print_pass "Web application builds successfully"
else
    print_fail "Web application build failed"
fi

print_section "Optional project infrastructure"

if [ -d .github/workflows ] &&
    find .github/workflows -type f | grep -q .; then
    print_pass "GitHub Actions workflow exists"
else
    print_warning "No GitHub Actions workflow exists yet"
fi

if git diff --quiet && git diff --cached --quiet; then
    print_pass "Tracked files have no uncommitted changes"
else
    print_warning "Repository contains uncommitted tracked changes"
fi

print_section "Summary"

printf "Failures: %s\n" "$FAILURES"
printf "Warnings: %s\n" "$WARNINGS"

if [ "$FAILURES" -gt 0 ]; then
    printf "\nRepository verification failed.\n"
    exit 1
fi

printf "\nRepository verification passed.\n"
