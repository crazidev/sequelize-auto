import _ from 'lodash';
import { check as isReserved } from 'reserved-words';
import { Utils } from 'sequelize';
import { ColumnDescription } from 'sequelize';

// Re-export utility types
export type LangOption = 'es5' | 'es6' | 'esm' | 'ts';
export type CaseOption = 'c' | 'l' | 'o' | 'p' | 'u';
export type CaseFileOption = 'k' | CaseOption;

/** Uses Inflector via Sequelize, but appends 's' if plural would be the same as singular.
 * Use `Utils.useInflection({ singularize: fn, pluralize: fn2 })` to configure. */
export function pluralize(s: string): string {
  let p = Utils.pluralize(s);
  if (p === Utils.singularize(s)) {
    p += 's';
  }
  return p;
}

/** Uses Inflector via Sequelize.  Use `Utils.useInflection({ singularize: fn, pluralize: fn2 })` to configure. */
export function singularize(s: string): string {
  return Utils.singularize(s);
}

/** Change casing of val string according to opt [c|l|o|p|u|k]  */
export function recase(opt: CaseOption | CaseFileOption | undefined, val: string | null, singular = false): string {
  if (singular && val) {
    val = singularize(val);
  }
  if (!opt || opt === 'o' || !val) {
    return val || ''; // original
  }
  if (opt === 'c') {
    return _.camelCase(val);
  }
  if (opt === 'k') {
    return _.kebabCase(val);
  }
  if (opt === 'l') {
    return _.snakeCase(val);
  }
  if (opt === 'p') {
    return _.upperFirst(_.camelCase(val));
  }
  if (opt === 'u') {
    return _.snakeCase(val).toUpperCase();
  }
  return val;
}

const tsReservedNames = ['DataTypes', 'Model', 'Optional', 'Sequelize'];

/** Make a valid table/model name */
export function makeTableName(
  opt: CaseOption | undefined,
  tableNameOrig: string | null,
  singular = false,
  lang = 'es5'
): string {
  let name = recase(opt, tableNameOrig, singular);
  if (isReserved(name) || (lang === 'ts' && tsReservedNames.includes(name))) {
    name += '_';
  }
  return name;
}

/** Build the array of indentation strings */
export function makeIndent(spaces: boolean | undefined, indent: number | undefined): string[] {
  let sp = '';
  for (let x = 0; x < (indent || 2); ++x) {
    sp += spaces === true ? ' ' : '\t';
  }
  const space: string[] = [];
  for (let i = 0; i < 6; i++) {
    space[i] = sp.repeat(i);
  }
  return space;
}

/** Split schema.table into [schema, table] */
export function qNameSplit(qname: string): [string | null, string] {
  if (qname.indexOf('.') > 0) {
    const [schemaName, tableNameOrig] = qname.split('.');
    return [schemaName, tableNameOrig];
  }
  return [null, qname];
}

/** Get combined schema.table name */
export function qNameJoin(schema: string | undefined, table: string | undefined): string {
  return !!schema ? schema + '.' + table : (table as string);
}

/** Quote the name if it is not a valid identifier */
export function quoteName(name: string): string {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(name) ? name : "'" + name + "'";
}

/** Escape special characters in a string */
export function escapeSpecial(val: string): string {
  if (typeof val !== 'string') {
    return val;
  }
  return val
    .replace(/[\\]/g, '\\\\')
    .replace(/[\"]/g, '\\"')
    .replace(/[\/]/g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t');
}

/** Type detection utilities */
export function isNumber(fieldType: string): boolean {
  return /^(smallint|mediumint|tinyint|int|bigint|float|money|smallmoney|double|decimal|numeric|real|oid)/.test(
    fieldType
  );
}

export function isBoolean(fieldType: string): boolean {
  return /^(boolean|bit)/.test(fieldType);
}

export function isDate(fieldType: string): boolean {
  return /^(datetime|timestamp)/.test(fieldType);
}

export function isString(fieldType: string): boolean {
  return /^(char|nchar|string|varying|varchar|nvarchar|text|longtext|mediumtext|tinytext|ntext|uuid|uniqueidentifier|date|time|inet|cidr|macaddr)/.test(
    fieldType
  );
}

export function isArray(fieldType: string): boolean {
  return /(^array)|(range$)/.test(fieldType);
}

export function isEnum(fieldType: string): boolean {
  return /^(enum)/.test(fieldType);
}

export function isJSON(fieldType: string): boolean {
  return /^(json|jsonb)/.test(fieldType);
}

export interface TSField {
  special: string[];
  elementType: string;
  type: string;
  allowNull?: boolean;
  defaultValue?: any;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  comment?: string | null;
  unique?: boolean | string;
  foreignKey?: any;
}

/** Get the TypeScript type for a field */
export function getTypeScriptFieldType(fieldObj: TSField, attr: keyof TSField): string {
  const rawFieldType = fieldObj[attr] || '';
  const fieldType = String(rawFieldType).toLowerCase();

  let jsType: string;

  if (isArray(fieldType)) {
    const eltype = getTypeScriptFieldType({ ...fieldObj, type: fieldObj.elementType } as TSField, 'type');
    jsType = eltype + '[]';
  } else if (isNumber(fieldType)) {
    jsType = 'number';
  } else if (isBoolean(fieldType)) {
    jsType = 'boolean';
  } else if (isDate(fieldType)) {
    jsType = 'Date';
  } else if (isString(fieldType)) {
    jsType = 'string';
  } else if (isEnum(fieldType)) {
    const values = getEnumValues(fieldObj);
    jsType = values.join(' | ');
  } else if (isJSON(fieldType)) {
    jsType = 'object';
  } else {
    console.log(`Missing TypeScript type: ${fieldType || fieldObj['type']}`);
    jsType = 'any';
  }
  return jsType;
}

/** Extract enum values from field definition */
export function getEnumValues(fieldObj: TSField): string[] {
  if (fieldObj.special && fieldObj.special.length > 0) {
    // postgres
    return fieldObj.special.map((v) => `"${v}"`);
  } else if (fieldObj.type) {
    // mysql - extract from ENUM('a','b','c') format
    return fieldObj.type.substring(5, fieldObj.type.length - 1).split(',');
  }
  return [];
}

/** Get the Sequelize DataType string for a field */
export function getSqType(fieldObj: TSField, dialectName?: string): string {
  const attrValue = fieldObj.type;
  if (!attrValue || !attrValue.toLowerCase) {
    return attrValue;
  }
  const type: string = attrValue.toLowerCase();
  const length = type.match(/\(\d+\)/);
  const precision = type.match(/\(\d+,\d+\)/);
  let val: string | null = null;
  let typematch = null;

  if (type === 'boolean' || type === 'bit(1)' || type === 'bit' || type === 'tinyint(1)') {
    val = 'DataTypes.BOOLEAN';

    // postgres range types
  } else if (type === 'numrange') {
    val = 'DataTypes.RANGE(DataTypes.DECIMAL)';
  } else if (type === 'int4range') {
    val = 'DataTypes.RANGE(DataTypes.INTEGER)';
  } else if (type === 'int8range') {
    val = 'DataTypes.RANGE(DataTypes.BIGINT)';
  } else if (type === 'daterange') {
    val = 'DataTypes.RANGE(DataTypes.DATEONLY)';
  } else if (type === 'tsrange' || type === 'tstzrange') {
    val = 'DataTypes.RANGE(DataTypes.DATE)';
  } else if ((typematch = type.match(/^(bigint|smallint|mediumint|tinyint|int)/))) {
    // integer subtypes
    val = 'DataTypes.' + (typematch[0] === 'int' ? 'INTEGER' : typematch[0].toUpperCase());
    if (/unsigned/i.test(type)) {
      val += '.UNSIGNED';
    }
    if (/zerofill/i.test(type)) {
      val += '.ZEROFILL';
    }
  } else if (type === 'nvarchar(max)' || type === 'varchar(max)') {
    val = 'DataTypes.TEXT';
  } else if (type.match(/n?varchar|string|varying/)) {
    val = 'DataTypes.STRING' + (!_.isNull(length) ? length : '');
  } else if (type.match(/^n?char/)) {
    val = 'DataTypes.CHAR' + (!_.isNull(length) ? length : '');
  } else if (type.match(/^real/)) {
    val = 'DataTypes.REAL';
  } else if (type.match(/text$/)) {
    val = 'DataTypes.TEXT' + (!_.isNull(length) ? length : '');
  } else if (type === 'date') {
    val = 'DataTypes.DATEONLY';
  } else if (type.match(/^(date|timestamp|year)/)) {
    val = 'DataTypes.DATE' + (!_.isNull(length) ? length : '');
  } else if (type.match(/^(time)/)) {
    val = 'DataTypes.TIME';
  } else if (type.match(/^(float|float4)/)) {
    val = 'DataTypes.FLOAT' + (!_.isNull(precision) ? precision : '');
  } else if (type.match(/^(decimal|numeric)/)) {
    val = 'DataTypes.DECIMAL' + (!_.isNull(precision) ? precision : '');
  } else if (type.match(/^money/)) {
    val = 'DataTypes.DECIMAL(19,4)';
  } else if (type.match(/^smallmoney/)) {
    val = 'DataTypes.DECIMAL(10,4)';
  } else if (type.match(/^(float8|double)/)) {
    val = 'DataTypes.DOUBLE' + (!_.isNull(precision) ? precision : '');
  } else if (type.match(/^uuid|uniqueidentifier/)) {
    val = 'DataTypes.UUID';
  } else if (type.match(/^jsonb/)) {
    val = 'DataTypes.JSONB';
  } else if (type.match(/^json/)) {
    val = 'DataTypes.JSON';
  } else if (type.match(/^geometry/)) {
    const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
    val = `DataTypes.GEOMETRY${gtype}`;
  } else if (type.match(/^geography/)) {
    const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
    val = `DataTypes.GEOGRAPHY${gtype}`;
  } else if (type.match(/^array/)) {
    const eltype = getSqType({ ...fieldObj, type: fieldObj.elementType } as TSField, dialectName);
    val = `DataTypes.ARRAY(${eltype})`;
  } else if (type.match(/(binary|image|blob|bytea)/)) {
    val = 'DataTypes.BLOB';
  } else if (type.match(/^hstore/)) {
    val = 'DataTypes.HSTORE';
  } else if (type.match(/^inet/)) {
    val = 'DataTypes.INET';
  } else if (type.match(/^cidr/)) {
    val = 'DataTypes.CIDR';
  } else if (type.match(/^oid/)) {
    val = 'DataTypes.INTEGER';
  } else if (type.match(/^macaddr/)) {
    val = 'DataTypes.MACADDR';
  } else if (type.match(/^enum(\(.*\))?$/)) {
    const enumValues = getEnumValues(fieldObj);
    val = `DataTypes.ENUM(${enumValues})`;
  }

  return val as string;
}

/** Check if field is a timestamp field (createdAt/updatedAt) */
export function isTimestampField(field: string, additional?: any): boolean {
  if (additional && additional.timestamps === false) {
    return false;
  }
  return (
    ((!additional || !additional.createdAt) && recase('c', field) === 'createdAt') ||
    (additional && additional.createdAt === field) ||
    ((!additional || !additional.updatedAt) && recase('c', field) === 'updatedAt') ||
    (additional && additional.updatedAt === field)
  );
}

/** Check if field is a paranoid field (deletedAt) */
export function isParanoidField(field: string, additional?: any): boolean {
  if (additional && (additional.timestamps === false || additional.paranoid === false)) {
    return false;
  }
  return (
    ((!additional || !additional.deletedAt) && recase('c', field) === 'deletedAt') ||
    (additional && additional.deletedAt === field)
  );
}

/** Check if field is in the skip list */
export function isIgnoredField(field: string, skipFields?: string[] | null): boolean {
  return skipFields != null && skipFields.includes(field);
}
