# Testing Rules

- Tests live in colocated `__tests__/` directories, named `*.spec.ts`.
- Use Jest as the test runner.
- Mock external dependencies (APIs, databases, Redis) — never hit real services in unit tests.
- Test the pipeline with mock `SourceConnector` and `TargetConnector` implementations.
- Every new Mapper, Normalizer, or Connector must ship with at least one test.
- Zod validators must have tests verifying both valid and invalid payloads.
- Run `pnpm run test` before committing to verify all tests pass.
- Run `npx tsc --noEmit` to verify zero type errors.
