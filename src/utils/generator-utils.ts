import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';
import { DialectOptions } from '../dialects/dialect-options';
import { Field, TSField } from '../types';

/**
 * Type checking functions
 */
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

/**
 * Field validation functions
 */
export function isIgnoredField(field: string, skipFields?: string[]): boolean {
  return skipFields ? skipFields.includes(field) : false;
}

export function isTimestampField(
  field: string,
  additional?: any
): boolean {
  if (additional?.timestamps === false) {
    return false;
  }
  return (
    (!additional?.createdAt && /^createdAt$/i.test(field)) ||
    additional?.createdAt === field ||
    (!additional?.updatedAt && /^updatedAt$/i.test(field)) ||
    additional?.updatedAt === field
  );
}

export function isParanoidField(
  field: string,
  additional?: any
): boolean {
  if (additional?.timestamps === false || additional?.paranoid === false) {
    return false;
  }
  return (!additional?.deletedAt && /^deletedAt$/i.test(field)) || additional?.deletedAt === field;
}

/**
 * Type conversion functions - converts DB types to Sequelize DataTypes
 */
export function getSqType(fieldObj: Field, attr: string, dialect?: DialectOptions): string {
  const attrValue = (fieldObj as any)[attr];
  if (!attrValue.toLowerCase) {
    console.log('attrValue', attr, attrValue);
    return attrValue;
  }
  const type: string = attrValue.toLowerCase();
  const length = type.match(/\(\d+\)/);
  const precision = type.match(/\(\d+,\d+\)/);
  let val = null;
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
    const eltype = getSqType(fieldObj, 'elementType', dialect);
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

/**
 * TypeScript helper functions
 */
export function getTypeScriptType(fieldObj: TSField, attr: keyof TSField): string {
  const rawFieldType = fieldObj[attr] || '';
  const fieldType = String(rawFieldType).toLowerCase();

  let jsType: string;

  if (isArray(fieldType)) {
    const eltype = getTypeScriptType(fieldObj, 'elementType');
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

export function getTypeScriptFieldType(fieldObj: TSField, attr: keyof TSField): string {
  return getTypeScriptType(fieldObj, attr);
}

export function getTypeScriptFieldOptional(fieldObj: ColumnDescription): boolean {
  return fieldObj.allowNull;
}

export function getTypeScriptPrimaryKeys(
  tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
  table: string
): Array<string> {
  const fields = _.keys(tables[table]);
  return fields.filter((field): boolean => {
    const fieldObj = tables[table][field];
    return fieldObj['primaryKey'];
  });
}

export function getTypeScriptCreationOptionalFields(
  tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
  table: string,
  isTimestampFieldFn: (field: string) => boolean
): Array<string> {
  const fields = _.keys(tables[table]);
  return fields.filter((field): boolean => {
    const fieldObj = tables[table][field];
    return (
      fieldObj.allowNull ||
      !!fieldObj.defaultValue ||
      fieldObj.defaultValue === '' ||
      fieldObj.autoIncrement ||
      isTimestampFieldFn(field)
    );
  });
}

export function getEnumValues(fieldObj: TSField): string[] {
  if (fieldObj.special) {
    // postgres
    return fieldObj.special.map((v) => `"${v}"`);
  } else {
    // mysql
    return fieldObj.type.substring(5, fieldObj.type.length - 1).split(',');
  }
}

/**
 * String utility functions
 */
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

export function quoteName(name: string): string {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(name) ? name : "'" + name + "'";
}

/**
 * Schema helper functions
 */
export function addSchemaForRelations(
  table: string,
  relations: any[],
  qNameSplit: (qname: string) => [string | null, string],
  qNameJoin: (schema: string | undefined, table: string | undefined) => string
): string {
  if (!table.includes('.') && !relations.some((rel) => rel.childTable === table)) {
    // if no tables match the given table, then assume we need to fix the schema
    const first = relations.find((rel) => !!rel.childTable);
    if (first) {
      const [schemaName, tableName] = qNameSplit(first.childTable);
      if (schemaName) {
        table = qNameJoin(schemaName, table);
      }
    }
  }
  return table;
}
