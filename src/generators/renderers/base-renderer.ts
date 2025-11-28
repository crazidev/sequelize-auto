import { ModelStructure } from '../types/model-structure';

/**
 * Abstract base renderer for converting ModelStructure to code strings
 */
export abstract class BaseRenderer {
  protected space: string[];

  constructor(space: string[]) {
    this.space = space;
  }

  /**
   * Render the complete model structure to a code string
   */
  abstract renderModel(structure: ModelStructure, tableName: string): string;

  /**
   * Render import statements
   */
  protected abstract renderImports(imports: ModelStructure['imports']): string;

  /**
   * Render class declaration
   */
  protected abstract renderClassDeclaration(
    classDecl: ModelStructure['classDeclaration'],
    tableName: string
  ): string;

  /**
   * Render a single field
   */
  protected abstract renderField(field: ModelStructure['classDeclaration']['fields'][0], tableName: string): string;

  /**
   * Render associations
   */
  protected abstract renderAssociations(associations: ModelStructure['classDeclaration']['associations']): string;

  /**
   * Render table options (for v6) or table decorator (for v7)
   */
  protected abstract renderTableOptions(
    tableOptions: ModelStructure['classDeclaration']['initMethod'] | undefined,
    tableName: string
  ): string;
}
