<!-- 2763c587-1760-49fc-9d92-8af1d5e04a25 91486bc9-60de-4e74-b0c1-ecdab7a98a12 -->
# Sequelize v7 Support with Component-Based Architecture

## Overview

Add full Sequelize v7 support to sequelize-auto using a component-based architecture with AST-like structures, renderers, and pluggable processors. This replaces string concatenation with a structured build-then-render approach for better maintainability and extensibility.

## Tasks

### 1. Configure SWC for Fast Building

- Install `@swc/cli` and `@swc/core` as dev dependencies
- Create `.swcrc` configuration file for TypeScript compilation with decorator support
- Update `package.json` scripts:
  - Change `build` from `tsc` to `swc src --out-dir lib`
  - Update `watch-build` to use SWC watch mode
  - Ensure `prepack` still works correctly
- Verify build output matches TypeScript compiler output

### 2. Add Version Input and Documentation

- Update `src/types.ts`:
  - Document `version?: 'v6' | 'v7'` in `AutoOptions` interface (line 189)
  - Add JSDoc comments explaining v6 vs v7 differences
- Update `bin/sequelize-auto`:
  - Add `--version` CLI option (alias `-v`) with description
  - Update help text to mention Sequelize version support
  - Pass version option through to AutoOptions
- Update README.md:
  - Document `--version` option
  - Explain differences between v6 and v7 output
  - Add examples for both versions
- Ensure version is passed to all required places:
  - `AutoGenerator` constructor
  - `AutoWriter` constructor
  - `AutoRelater` (if needed)

### 3. Install Sequelize v7

- Install `@sequelize/core@alpha` as a dependency (not devDependency)
- Install dialect packages as needed:
  - `@sequelize/postgres` (or keep `pg` + `pg-hstore`)
  - `@sequelize/mysql` (or keep `mysql2`)
  - `@sequelize/sqlite3` (or keep `sqlite3`)
  - `@sequelize/mssql` (or keep `tedious`)
- Keep `sequelize@^6` as devDependency for testing v6 compatibility
- Update imports in code to support both v6 and v7

### 4. Setup TypeScript Config for Decorators

- Update `tsconfig.json`:
  - Add `"experimentalDecorators": true`
  - Add `"emitDecoratorMetadata": true`
  - Ensure `target` is ES2020 or higher
  - Update `lib` to include decorator support
- Verify decorators compile correctly with SWC

### 5. Review Sequelize v7 Upgrade Guide

- Review https://sequelize.org/docs/v7/other-topics/upgrade/ for breaking changes
- Key changes to implement:
  - Import path changes: `sequelize` → `@sequelize/core`
  - Dialect packages are separate
  - Constructor signature changes (single object only)
  - New model initialization patterns
  - Decorator support for TypeScript models
  - Association API changes (if any)

### 6. Extract Utility Functions

- Extract utilities from `auto-generator.ts` to `src/utils/generator-utils.ts`:
  - **Type checking functions**: `isNumber()`, `isBoolean()`, `isDate()`, `isString()`, `isArray()`, `isEnum()`, `isJSON()`
  - **Field validation functions**: `isIgnoredField()`, `isTimestampField()`, `isParanoidField()`
  - **Type conversion functions**: `getSqType()` - converts DB types to Sequelize DataTypes
  - **TypeScript helper functions**: `getTypeScriptType()`, `getTypeScriptFieldType()`, `getTypeScriptFieldOptional()`, `getTypeScriptPrimaryKeys()`, `getTypeScriptCreationOptionalFields()`, `getEnumValues()`
  - **String utility functions**: `escapeSpecial()`, `quoteName()`
  - **Schema helper functions**: `addSchemaForRelations()`
  - All functions should be pure (no class dependencies where possible)
  - Export as named exports for easy importing

- Extract utilities from `auto-relater.ts` to `src/utils/relater-utils.ts`:
  - `getAlias()` - Convert FK name to alias for belongsTo relations
  - `getChildAlias()` - Convert FK name to alias for hasMany/hasOne relations
  - `trimId()` - Trim primary key suffixes from names
  - Functions may need context (caseProp, pkSuffixes, usedChildNames) - pass as parameters

- Extract utilities from `auto-builder.ts` to `src/utils/builder-utils.ts`:
  - `mapOptionTables()` - Map option table strings to Table objects
  - `isTableEqual()` - Compare two Table objects for equality
  - `makeTableQName()` - Create qualified table name (schema.table)

- Extract utilities from `auto-writer.ts` to `src/utils/writer-utils.ts`:
  - File naming and path utilities (if any reusable functions exist)

- Update all auto-* files to import from their respective utils files
- Ensure all utilities are properly typed and documented

### 7. Create Component-Based Architecture Core

- Create core data structures (`src/generators/types/model-structure.ts`):
  - `ModelStructure` - Complete model representation
  - `ImportStatement`, `ClassDeclaration`, `FieldDefinition`
  - `FieldAttribute`, `AttributeFormat`, `Decorator`
  - `AssociationDefinition`, `InitMethod`, `TableOptions`
  - `ExportStatement` and related types
  - `ProcessorContext` - Context passed to processors

- Create builder classes:
  - `ModelBuilder` - Builds complete ModelStructure
  - `FieldBuilder` - Builds FieldDefinition with attributes

- Create attribute processors (`src/generators/processors/`):
  - **Base interface** (`attribute-processor.ts`):
    - `AttributeProcessor` interface with:
      - `canProcess(attrName: string, version: 'v6' | 'v7'): boolean` - Check if processor handles attribute
      - `process(fieldObj, attrName, attrValue, context): FieldAttribute | null` - Process for v6 format
      - `getDecorators?(fieldObj, attrName, attrValue, context): Decorator[] | undefined` - Get decorators for v7 format
    - `ProcessorContext` interface with version, lang, dialect, foreignKey, isSerialKey, space, etc.

  - **Processor implementations**:
    - `PrimaryKeyProcessor` - Handles `primaryKey` attribute
      - v6: `{ primaryKey: true }`
      - v7: `@PrimaryKey` decorator
    - `AutoIncrementProcessor` - Handles `autoIncrement` attribute
      - v6: `{ autoIncrement: true }`
      - v7: `@AutoIncrement` decorator
    - `AllowNullProcessor` - Handles `allowNull` attribute
      - v6: `{ allowNull: true/false }`
      - v7: `@NotNull` decorator (only when false)
    - `DefaultValueProcessor` - Handles `defaultValue` attribute
      - v6: `{ defaultValue: value }` (handles functions, literals, strings, etc.)
      - v7: `@Default(value)` decorator
      - Complex formatting logic for different value types
    - `ForeignKeyProcessor` - Handles `foreignKey` and `references` attributes
      - v6: `{ references: { model: 'Table', key: 'id' } }`
      - v7: Handled via association decorators, not field attributes
    - `UniqueProcessor` - Handles `unique` attribute
      - v6: `{ unique: true }` or `{ unique: "index_name" }`
      - v7: `@Unique` or `@Unique("index_name")` decorator

  - Each processor is self-contained and testable independently
  - Processors use utility functions from `generator-utils.ts` where needed

### 7. Create Renderers

- Create renderer base (`src/generators/renderers/base-renderer.ts`):
  - Abstract `BaseRenderer` with `renderModel()` template method
  - Abstract methods: `renderImports()`, `renderClassDeclaration()`, `renderField()`, etc.
- Create version-specific renderers:
  - `V6Renderer` - Renders v6 format (Model.init pattern)
  - `V7Renderer` - Renders v7 format (decorator pattern)
  - Both handle CJS vs ESM module systems

### 8. Create Generators

- Create `V6Generator` (`src/generators/v6-generator.ts`):
  - Uses `ModelBuilder`, `FieldBuilder`, attribute processors
  - Uses `V6Renderer` for code generation
  - Handles all module systems (CJS, ESM) and languages (JS, TS)
- Create `V7Generator` (`src/generators/v7-generator.ts`):
  - Uses `ModelBuilder`, `FieldBuilder`, attribute processors
  - Uses `V7Renderer` for code generation with decorators
  - Handles all module systems and languages
- Create `GeneratorFactory` (`src/generators/generator-factory.ts`):
  - Factory method to select `V6Generator` or `V7Generator` based on version

### 9. Refactor AutoGenerator

- Refactor `src/auto-generator.ts`:
  - Use `GeneratorFactory` to get appropriate generator
  - Delegate `generateText()` to selected generator
  - Keep `generateMigration()` (can be refactored later)
  - Maintain backward compatibility with existing API
  - Remove all string concatenation logic (moved to renderers)

### 10. Update AutoWriter for Sequelize v7 Initialization

- Review new v7 initialization patterns:
  ```typescript
  // Pattern 1: Direct models array
  import { Sequelize } from '@sequelize/core';
  import { SqliteDialect } from '@sequelize/sqlite3';
  import { User } from './models/user.model.js';
  
  export const sequelize = new Sequelize({
    dialect: SqliteDialect,
    models: [User],
  });
  
  // Pattern 2: importModels helper
  import { Sequelize, importModels } from '@sequelize/core';
  import { SqliteDialect } from '@sequelize/sqlite3';
  
  export const sequelize = new Sequelize({
    dialect: SqliteDialect,
    models: await importModels(__dirname + '/**/*.model.{ts,js}'),
  });
  ```

- Create init string generators:
  - `InitStringGenerator` base interface
  - `V6InitStringGenerator` - handles v6 init patterns
  - `V7InitStringGenerator` - handles v7 init patterns (new patterns)
  - `InitGeneratorFactory` - selects generator based on version
- Refactor `AutoWriter`:
  - Use init generator factory
  - Move `setInitMethod()` to `V6InitStringGenerator`
  - Move `addExport()` to init generators
  - Keep `setTableOptions()` in generators (used during model generation)

## Architecture Details

### Component-Based Flow

1. **Build Phase**: Use builders to create structured representation

   - `ModelBuilder` creates `ModelStructure`
   - `FieldBuilder` creates `FieldDefinition` with attributes
   - Attribute processors convert field properties to `FieldAttribute` objects

2. **Render Phase**: Use renderers to convert structure to code

   - `V6Renderer` or `V7Renderer` renders the `ModelStructure`
   - Handles module system differences (CJS vs ESM)
   - Applies version-specific formatting

3. **Processor Pattern**: Pluggable attribute processors

   - Each processor handles one attribute type (primaryKey, defaultValue, etc.)
   - Processors can generate both v6 and v7 formats
   - Easy to add new processors without touching core logic

### Version Handling Strategy

- Default to `v6` for backward compatibility
- When `version: 'v7'`:
  - Use `@sequelize/core` imports
  - Generate decorator-based models (TypeScript)
  - Use new initialization patterns
  - Handle dialect package imports

### Decorator Support

- For v7 TypeScript models, generate:
  ```typescript
  @Table({ timestamps: true, tableName: 'users' })
  export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    @Attribute(DataTypes.INTEGER)
    @PrimaryKey
    @AutoIncrement
    declare id: CreationOptional<number>;
    // ...
  }
  ```

- For v7 JavaScript, still use `Model.init()` (decorators are TypeScript-only)
- Decorators are added via `FieldDefinition.decorators` array
- Processors generate decorators via `getDecorators()` method

### Module System Support

- CJS (es5, es6): `require()` statements
- ESM (esm, ts): `import`/`export` statements
- Both v6 and v7 support all module systems
- Renderers handle module system differences

## Files to Create/Modify

**New Files:**

- `.swcrc` - SWC configuration
- `src/generators/types/model-structure.ts` - Core data structures
- `src/generators/builders/model-builder.ts` - ModelStructure builder
- `src/generators/builders/field-builder.ts` - FieldDefinition builder
- `src/generators/processors/attribute-processor.ts` - Base processor interface
- `src/generators/processors/primary-key-processor.ts` - Primary key processor
- `src/generators/processors/auto-increment-processor.ts` - Auto increment processor
- `src/generators/processors/allow-null-processor.ts` - Allow null processor
- `src/generators/processors/default-value-processor.ts` - Default value processor
- `src/generators/processors/foreign-key-processor.ts` - Foreign key processor
- `src/generators/processors/unique-processor.ts` - Unique constraint processor
- `src/generators/renderers/base-renderer.ts` - Abstract base renderer
- `src/generators/renderers/v6-renderer.ts` - V6 format renderer
- `src/generators/renderers/v7-renderer.ts` - V7 format renderer (decorators)
- `src/generators/v6-generator.ts` - V6 generator using component architecture
- `src/generators/v7-generator.ts` - V7 generator using component architecture
- `src/generators/generator-factory.ts` - Factory to select v6/v7 generator
- `src/writers/base/init-string-generator.ts` - Base init string generator interface
- `src/writers/v6-init-generator.ts` - V6 init string generator
- `src/writers/v7-init-generator.ts` - V7 init string generator (new patterns)
- `src/writers/init-generator-factory.ts` - Factory for init generators

**Modified Files:**

- `package.json` - Add SWC, update scripts, add @sequelize/core@alpha
- `tsconfig.json` - Add decorator support (experimentalDecorators, emitDecoratorMetadata)
- `src/types.ts` - Document version option in AutoOptions
- `bin/sequelize-auto` - Add version CLI option, pass through to options
- `src/auto-generator.ts` - Refactor to use generator factory, delegate to v6/v7 generators
- `src/auto-writer.ts` - Refactor to use init generator factory, add v7 support
- `README.md` - Document version option, v7 features, and component architecture

## Testing Considerations

- Test both v6 and v7 generation
- Test all module systems (CJS, ESM) with both versions
- Test decorator generation for v7 TypeScript
- Test new initialization patterns
- Test attribute processors independently
- Test renderers independently
- Ensure backward compatibility with existing v6 code

### To-dos

- [x] Install SWC packages and create .swcrc config, update package.json build scripts to use SWC instead of tsc
- [x] Add version option to CLI (bin/sequelize-auto), update types.ts documentation, pass version through to all components
- [x] Install @sequelize/core@alpha and required dialect packages, keep sequelize v6 for dev/testing
- [ ] Update tsconfig.json to enable experimentalDecorators and emitDecoratorMetadata, verify SWC supports decorators
- [ ] Review Sequelize v7 upgrade guide, identify breaking changes, update code generation logic for v7 differences
- [ ] Create core data structures (ModelStructure, FieldDefinition, ImportStatement, etc.) in src/generators/types/model-structure.ts
- [ ] Create ModelBuilder and FieldBuilder classes for building structured model representations
- [ ] Create AttributeProcessor interface and implement processors (PrimaryKey, AutoIncrement, DefaultValue, ForeignKey, Unique, etc.)
- [ ] Create BaseRenderer abstract class and implement V6Renderer and V7Renderer for rendering model structures to code
- [ ] Create V6Generator and V7Generator using builders, processors, and renderers. Create GeneratorFactory to select generator
- [ ] Refactor AutoGenerator to use GeneratorFactory, delegate to v6/v7 generators, maintain backward compatibility
- [ ] Create base InitStringGenerator interface and V6InitStringGenerator, V7InitStringGenerator implementations for init-models file
- [ ] Refactor AutoWriter to use pluggable init generators, move setInitMethod and addExport to generators, update for v7 patterns
- [ ] Update README.md with version option documentation, v7 examples, component architecture overview, and migration guide
- [x] Install SWC packages and create .swcrc config, update package.json build scripts to use SWC instead of tsc
- [x] Add version option to CLI (bin/sequelize-auto), update types.ts documentation, pass version through to all components
- [x] Install @sequelize/core@alpha and required dialect packages, keep sequelize v6 for dev/testing
- [ ] Update tsconfig.json to enable experimentalDecorators and emitDecoratorMetadata, verify SWC supports decorators
- [ ] Review Sequelize v7 upgrade guide, identify breaking changes, update code generation logic for v7 differences
- [ ] Create core data structures (ModelStructure, FieldDefinition, ImportStatement, etc.) in src/generators/types/model-structure.ts
- [ ] Create ModelBuilder and FieldBuilder classes for building structured model representations
- [ ] Create AttributeProcessor interface and implement processors (PrimaryKey, AutoIncrement, DefaultValue, ForeignKey, Unique, etc.)
- [ ] Create BaseRenderer abstract class and implement V6Renderer and V7Renderer for rendering model structures to code
- [ ] Create V6Generator and V7Generator using builders, processors, and renderers. Create GeneratorFactory to select generator
- [ ] Refactor AutoGenerator to use GeneratorFactory, delegate to v6/v7 generators, maintain backward compatibility
- [ ] Create base InitStringGenerator interface and V6InitStringGenerator, V7InitStringGenerator implementations for init-models file
- [ ] Refactor AutoWriter to use pluggable init generators, move setInitMethod and addExport to generators, update for v7 patterns
- [ ] Update README.md with version option documentation, v7 examples, component architecture overview, and migration guide