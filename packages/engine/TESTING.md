# Engine testing

Run these commands from the Blur Lab repository root.

## Run all engine tests once

```bash
corepack pnpm --filter @blurlab/engine test
```

## Run tests continuously while editing

```bash
corepack pnpm --filter @blurlab/engine test:watch
```

## Run one test file

```bash
corepack pnpm --filter @blurlab/engine exec vitest run test/kernel.test.ts
```

Replace `test/kernel.test.ts` with another test path when needed.

## Run tests matching a name

```bash
corepack pnpm --filter @blurlab/engine exec vitest run -t "rejects NaN weights"
```

The `-t` value can be any complete or partial test name.

## Short form

If `pnpm` is already activated through Corepack, omit `corepack`:

```bash
pnpm --filter @blurlab/engine test
```
