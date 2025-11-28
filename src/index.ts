import { SequelizeAuto } from './auto';
import { FKSpec, FKRelation } from './dialects/dialect-options';
import { AutoOptions, CaseOption, TableData } from './types';

// Export generators
export * from './generators';

// Export utility functions
export * from './utils/GeneratorUtils';

// Main exports
export { SequelizeAuto, AutoOptions, TableData, CaseOption, FKSpec, FKRelation };

export default SequelizeAuto;
