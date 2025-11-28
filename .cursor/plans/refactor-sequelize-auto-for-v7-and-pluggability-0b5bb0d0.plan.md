<!-- 0b5bb0d0-2bb3-48ae-9f7c-2c43e3f580f1 b72cae7f-4937-4dde-8dc1-e6ec34299df6 -->
# Refactor Sequelize Auto

## 1. Architecture & Utilities

- [x] Create `src/utils/GeneratorUtils.ts` to house shared utility functions (recase, pluralize, etc.) currently in `src/auto-generator.ts` and `src/types.ts`.
- [x] Create `src/generators/IGenerator.ts` interfaces defining the contract for the main generators (`generateModel`, `generateInit`, `generateMigration`).

## 2. Dependencies

- [ ] Install `@sequelize/core@alpha` using Bun.

## 3. Component Generators (The "Pluggable" Parts)

- [ ] Create `src/generators/components/IComponentGenerator.ts` interfaces for sub-generators.
- [ ] **ImportGenerator**: Create `src/generators/components/ImportGenerator.ts` (Abstract + V6/V7 implementations).
- Implement specific methods: `generateESM`, `generateES6`, `generateES5`, `generateTS`.
- Reuse logic where patterns overlap.
- [ ] **FieldGenerator**: Create `src/generators/components/FieldGenerator.ts` (Abstract + V6/V7 implementations).
- Implement `generateTS` and `generateJS` methods.
- `generateJS` handles all JavaScript output (ES5, ES6, ESM).
- [ ] **TableOptionsGenerator**: Create `src/generators/components/TableOptionsGenerator.ts` (Abstract + V6/V7 implementations).
- V6: Handle both `Model.init()` and `sequelize.define()` patterns (via `useDefine` option).
  - `useDefine` outputs `sequelize.define('Name', { fields }, { options })`.
  - `init` outputs `class Name extends Model {}; Name.init({ fields }, { options })`.
- V7: Handle `@Table` decorator pattern.
- [ ] **IndexGenerator**: Create `src/generators/components/IndexGenerator.ts` handling index definitions.
- [ ] **RelationGenerator**: Create `src/generators/components/RelationGenerator.ts` handling both TS mixins/declarations and runtime association code (`belongsTo`, etc.).
- Add `associationMixins` option to `AutoOptions`:
  - `'all'` (default): Generate property + all mixins (`get`, `set`, `add`, `create`, `remove`, `has`, `count`).
  - `'property'`: Generate only the property (`declare alerts: ...`).
  - `'none'`: Do not generate any association declarations in the model body.

## 4. Main Generators (Orchestrators)

- [ ] **ModelGenerator**: Create `src/generators/ModelGenerator.ts` (Abstract + V6/V7). Orchestrates the components to produce the model file content.
- **V6Generator**: Needs to handle the structural difference between Class-based `init` and functional `define`.
  - If `useDefine`: 
  - Generate `interface I[ModelName]Model extends Model<InferAttributes<...>, InferCreationAttributes<...>>`.
  - Generate `export const [ModelName] = sequelize.define<I[ModelName]Model>('ModelName', { ... }, { ... });`.
  - If standard: 
  - Generate `export class [ModelName] extends Model<InferAttributes<...>, InferCreationAttributes<...>>`.
  - Generate `static initModel(...) { [ModelName].init(...) }`.
- **V7Generator**: Uses Class-based decorator structure.
- [ ] **InitGenerator**: Create `src/generators/InitGenerator.ts`. Extracts `init-models` logic from `AutoWriter`. Uses `RelationGenerator` for association setup.
- [ ] **MigrationGenerator**: Create `src/generators/MigrationGenerator.ts`. Extracts migration logic from `AutoGenerator`.

## 5. Factory & Integration

- [ ] Create `src/generators/GeneratorFactory.ts` to instantiate the correct generator strategy (V6/V7) and its components based on options.
- [ ] Refactor `src/auto-writer.ts` to be a "dumb" writer. It should receive file contents from `InitGenerator` and `ModelGenerator` and just write them to disk.
- [ ] Update `src/auto.ts` to use `GeneratorFactory`.

## 6. Build & Types

- [ ] Create `.swcrc` configuration file for SWC.
- [ ] Update `src/types.ts` to reflect new options and types.
- [ ] Delete `src/auto-generator.ts` after migration.

## 7. Verification

- [ ] Verify `src/auto.ts` correctly orchestrates the new flow.
- [ ] Ensure existing tests pass or update them to match the new architecture.

### To-dos

- [ ] Create src/utils/GeneratorUtils.ts
- [ ] Create src/generators/IGenerator.ts
- [ ] Install @sequelize/core@alpha using Bun
- [ ] Create Component Generators (Import, Field, Table, Index, Relation)
- [ ] Implement ModelGenerator (V6 & V7)
- [ ] Implement InitGenerator
- [ ] Implement MigrationGenerator
- [ ] Create GeneratorFactory
- [ ] Refactor AutoWriter to be dumb
- [ ] Update Auto and Types
- [ ] Setup SWC and cleanup