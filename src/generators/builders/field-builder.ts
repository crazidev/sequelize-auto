import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';
import { DialectOptions, FKSpec } from '../../dialects/dialect-options';
import { Field, CaseOption, recase } from '../../types';
import {
  getSqType,
  getTypeScriptFieldType,
  getTypeScriptFieldOptional,
  isIgnoredField,
  isParanoidField,
  isTimestampField,
  quoteName,
} from '../../utils/generator-utils';
import {
  AllowNullProcessor,
  AttributeProcessor,
  AutoIncrementProcessor,
  DefaultValueProcessor,
  ForeignKeyProcessor,
  PrimaryKeyProcessor,
  UniqueProcessor,
} from '../processors';
import { Decorator, FieldDefinition, ProcessorContext } from '../types/model-structure';

export class FieldBuilder {
  private processors: AttributeProcessor[];

  constructor() {
    this.processors = [
      new PrimaryKeyProcessor(),
      new AutoIncrementProcessor(),
      new AllowNullProcessor(),
      new DefaultValueProcessor(),
      new ForeignKeyProcessor(),
      new UniqueProcessor(),
    ];
  }

  buildField(
    field: string,
    fieldObj: Field,
    table: string,
    foreignKey: FKSpec | null,
    context: ProcessorContext,
    skipFields?: string[],
    additional?: any
  ): FieldDefinition | null {
    // Ignore timestamp and paranoid fields if timestamps are enabled
    if (
      additional &&
      additional.timestamps !== false &&
      (isTimestampField(field, additional) || isParanoidField(field, additional))
    ) {
      return null;
    }

    if (isIgnoredField(field, skipFields)) {
      return null;
    }

    const fieldName = recase(context.caseProp, field);
    const unique = fieldObj.unique || (fieldObj.foreignKey && fieldObj.foreignKey.isUnique);

    const isSerialKey =
      (fieldObj.foreignKey && fieldObj.foreignKey.isSerialKey) ||
      (context.dialect.isSerialKey && context.dialect.isSerialKey(fieldObj));

    const processorContext: ProcessorContext = {
      ...context,
      foreignKey: foreignKey || fieldObj.foreignKey || null,
      isSerialKey,
    };

    // Build attributes and decorators
    const attributes: any[] = [];
    const decorators: Decorator[] = [];

    // Process each attribute
    const fieldAttrs = _.keys(fieldObj);
    let wroteAutoIncrement = false;

    fieldAttrs.forEach((attr) => {
      // Skip special attributes
      if (attr === 'special' || attr === 'elementType' || attr === 'unique') {
        return;
      }

      // Handle autoIncrement for serial keys
      if (isSerialKey && !wroteAutoIncrement && attr !== 'autoIncrement') {
        const autoIncProcessor = this.processors.find((p) => p.canProcess('autoIncrement', context.version));
        if (autoIncProcessor) {
          if (context.version === 'v6') {
            const attrResult = autoIncProcessor.process(fieldObj, 'autoIncrement', true, processorContext);
            if (attrResult) {
              attributes.push(attrResult);
            }
          } else {
            const decoratorResult = autoIncProcessor.getDecorators?.(fieldObj, 'autoIncrement', true, processorContext);
            if (decoratorResult) {
              decorators.push(...decoratorResult);
            }
          }
          wroteAutoIncrement = true;
        }
      }

      // Find and use appropriate processor
      const processor = this.processors.find((p) => p.canProcess(attr, context.version));
      if (processor) {
        if (context.version === 'v6') {
          const attrResult = processor.process(fieldObj, attr, (fieldObj as any)[attr], processorContext);
          if (attrResult) {
            attributes.push(attrResult);
          }
        } else {
          const decoratorResult = processor.getDecorators?.(fieldObj, attr, (fieldObj as any)[attr], processorContext);
          if (decoratorResult) {
            decorators.push(...decoratorResult);
          }
        }
      } else {
        // Handle attributes without processors (type, comment, etc.)
        if (attr === 'type') {
          const typeVal = getSqType(fieldObj, attr, context.dialect);
          if (context.version === 'v6') {
            attributes.push({
              name: 'type',
              value: typeVal,
              format: 'v6',
            });
          } else {
            decorators.push({
              name: 'Attribute',
              arguments: [typeVal],
            });
          }
        } else if (attr === 'comment' && fieldObj[attr] && context.dialect.name !== 'mssql') {
          const commentVal = `"${fieldObj[attr]}"`;
          if (context.version === 'v6') {
            attributes.push({
              name: 'comment',
              value: commentVal,
              format: 'v6',
            });
          } else {
            decorators.push({
              name: 'Comment',
              arguments: [commentVal],
            });
          }
        } else if (attr !== 'foreignKey' && attr !== 'references') {
          // Other attributes
          const val = (fieldObj as any)[attr];
          const valStr = _.isString(val) ? `"${val}"` : val;
          if (context.version === 'v6') {
            attributes.push({
              name: attr,
              value: valStr,
              format: 'v6',
            });
          }
        }
      }
    });

    // Handle unique constraint
    if (unique) {
      const uniqueProcessor = this.processors.find((p) => p.canProcess('unique', context.version));
      if (uniqueProcessor && context.version === 'v7') {
        const decoratorResult = uniqueProcessor.getDecorators?.(fieldObj, 'unique', unique, processorContext);
        if (decoratorResult) {
          decorators.push(...decoratorResult);
        }
      } else if (context.version === 'v6') {
        const uniq = _.isString(unique) ? `"${unique.replace(/\"/g, '\\"')}"` : unique;
        attributes.push({
          name: 'unique',
          value: uniq,
          format: 'v6',
        });
      }
    }

    // Handle column name mapping
    if (field !== fieldName) {
      if (context.version === 'v6') {
        attributes.push({
          name: 'field',
          value: `'${field}'`,
          format: 'v6',
        });
      } else {
        decorators.push({
          name: 'ColumnName',
          arguments: [`'${field}'`],
        });
      }
    }

    // Get TypeScript type information
    let tsType: string | undefined;
    let tsOptional: boolean | undefined;
    if (context.lang === 'ts') {
      tsType = getTypeScriptFieldType(fieldObj as any, 'type');
      tsOptional = getTypeScriptFieldOptional(fieldObj);
    }

    return {
      name: fieldName,
      dbName: field,
      type: getSqType(fieldObj, 'type', context.dialect),
      attributes,
      decorators,
      tsType,
      tsOptional,
      isTimestamp: isTimestampField(field, additional),
      isParanoid: isParanoidField(field, additional),
    };
  }
}
