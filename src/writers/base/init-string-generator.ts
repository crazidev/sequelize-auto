import { CaseFileOption, CaseOption, LangOption, makeTableName, recase } from '../../types';

/**
 * Base interface for init string generators
 * Handles generation of init-models file content
 */
export interface InitStringGenerator {
  /**
   * Generate the init-models file content
   */
  generate(
    tableNames: string[],
    associations: string,
    options: {
      lang?: LangOption;
      caseFile?: CaseFileOption;
      caseModel?: CaseOption;
      singularize?: boolean;
      space: string[];
    }
  ): string;
}
