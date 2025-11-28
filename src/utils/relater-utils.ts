import { CaseOption, recase, singularize } from '../types';

/**
 * Convert foreign key name into alias name for belongsTo relations
 */
export function getAlias(
  fkFieldName: string,
  modelName: string,
  targetModel: string,
  caseProp: CaseOption,
  pkSuffixes: string[],
  usedChildNames: Set<string>,
  isM2M = false
): string {
  let name = trimId(fkFieldName, pkSuffixes);
  if (name === fkFieldName || isM2M) {
    name = fkFieldName + '_' + modelName;
  }

  // singularize in case one column name is the singularized form of another column in the same model
  let singleName = singularize(name);
  if (isM2M) {
    if (usedChildNames.has(modelName + '.' + singleName)) {
      name = name + '_' + targetModel;
    }
    usedChildNames.add(modelName + '.' + singularize(name));
  } else {
    if (usedChildNames.has(targetModel + '.' + singleName)) {
      name = name + '_' + modelName;
    }
    usedChildNames.add(targetModel + '.' + singularize(name));
  }
  return recase(caseProp, name, true);
}

/**
 * Convert foreign key name into alias name for hasMany/hasOne relations
 */
export function getChildAlias(
  fkFieldName: string,
  modelName: string,
  targetModel: string,
  caseProp: CaseOption,
  pkSuffixes: string[],
  usedChildNames: Set<string>
): string {
  let name = modelName;
  // usedChildNames prevents duplicate names in same model
  if (usedChildNames.has(targetModel + '.' + singularize(name))) {
    name = trimId(fkFieldName, pkSuffixes);
    name = name + '_' + modelName;
  }
  // singularize in case one column name is the singularized form of another column in the same model
  name = singularize(name);
  usedChildNames.add(targetModel + '.' + name);
  return recase(caseProp, name, true);
}

/**
 * Trim primary key suffixes from names
 */
export function trimId(name: string, pkSuffixes: string[]): string {
  pkSuffixes.forEach((suffix) => {
    if (name.length > suffix.length + 1 && name.toLowerCase().endsWith(suffix.toLowerCase())) {
      name = name.substring(0, name.length - suffix.length);
    }
  });

  if (name.endsWith('_')) {
    name = name.substring(0, name.length - 1);
  }
  return name;
}
