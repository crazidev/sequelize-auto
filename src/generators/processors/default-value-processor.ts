import _ from 'lodash';
import { Field } from '../../types';
import { escapeSpecial } from '../../utils/generator-utils';
import { AttributeProcessor } from './attribute-processor';
import { Decorator, FieldAttribute, ProcessorContext } from '../types/model-structure';

export class DefaultValueProcessor implements AttributeProcessor {
  canProcess(attrName: string, version: 'v6' | 'v7'): boolean {
    return attrName === 'defaultValue';
  }

  process(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): FieldAttribute | null {
    let defaultVal = attrValue;

    // Handle MS SQL specific cases
    if (context.dialect.name === 'mssql' && defaultVal && defaultVal.toLowerCase() === '(newid())') {
      defaultVal = null as any; // disable adding "default value" attribute for UUID fields
    }
    if (
      context.dialect.name === 'mssql' &&
      (['(NULL)', 'NULL'].includes(defaultVal) || typeof defaultVal === 'undefined')
    ) {
      defaultVal = null as any; // Override default NULL in MS SQL to javascript null
    }

    if (defaultVal === null || defaultVal === undefined) {
      return null;
    }
    if (context.isSerialKey) {
      return null; // value generated in the database
    }

    const val_text = this.formatDefaultValue(defaultVal, fieldObj, context);
    return {
      name: 'defaultValue',
      value: val_text,
      format: 'v6',
    };
  }

  getDecorators(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): Decorator[] | undefined {
    let defaultVal = attrValue;

    // Handle MS SQL specific cases
    if (context.dialect.name === 'mssql' && defaultVal && defaultVal.toLowerCase() === '(newid())') {
      defaultVal = null as any;
    }
    if (
      context.dialect.name === 'mssql' &&
      (['(NULL)', 'NULL'].includes(defaultVal) || typeof defaultVal === 'undefined')
    ) {
      defaultVal = null as any;
    }

    if (defaultVal === null || defaultVal === undefined) {
      return undefined;
    }
    if (context.isSerialKey) {
      return undefined;
    }

    const val_text = this.formatDefaultValue(defaultVal, fieldObj, context);
    return [
      {
        name: 'Default',
        arguments: [val_text],
      },
    ];
  }

  private formatDefaultValue(defaultVal: any, fieldObj: Field, context: ProcessorContext): string {
    const quoteWrapper = '"';
    let val_text = defaultVal;

    if (_.isString(defaultVal)) {
      const field_type = fieldObj.type.toLowerCase();
      defaultVal = escapeSpecial(defaultVal);

      while (defaultVal.startsWith('(') && defaultVal.endsWith(')')) {
        // remove extra parens around mssql defaults
        defaultVal = defaultVal.replace(/^[(]/, '').replace(/[)]$/, '');
      }

      if (field_type === 'bit(1)' || field_type === 'bit' || field_type === 'boolean') {
        // convert string to boolean
        val_text = /1|true/i.test(defaultVal) ? 'true' : 'false';
      } else if (/(^array)|(range$)/.test(field_type)) {
        // remove outer {}
        val_text = defaultVal.replace(/^{/, '').replace(/}$/, '');
        if (val_text && _.isString(fieldObj.elementType)) {
          // quote the array elements
          val_text = val_text
            .split(',')
            .map((s) => `"${s}"`)
            .join(',');
        }
        val_text = `[${val_text}]`;
      } else if (field_type.match(/^(json)/)) {
        // don't quote json
        val_text = defaultVal;
      } else if (
        field_type === 'uuid' &&
        (defaultVal === 'gen_random_uuid()' || defaultVal === 'uuid_generate_v4()')
      ) {
        val_text = 'DataTypes.UUIDV4';
      } else if (defaultVal.match(/\w+\(\)$/)) {
        // replace db function with sequelize function
        val_text = "Sequelize.Sequelize.fn('" + defaultVal.replace(/\(\)$/g, '') + "')";
      } else if (/^(smallint|mediumint|tinyint|int|bigint|float|money|smallmoney|double|decimal|numeric|real|oid)/.test(field_type)) {
        if (defaultVal.match(/\(\)/g)) {
          // assume it's a server function if it contains parens
          val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
        } else {
          // don't quote numbers
          val_text = defaultVal;
        }
      } else if (defaultVal.match(/\(\)/g)) {
        // embedded function, pass as literal
        val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
      } else if (field_type.indexOf('date') === 0 || field_type.indexOf('timestamp') === 0) {
        if (
          _.includes(
            ['current_timestamp', 'current_date', 'current_time', 'localtime', 'localtimestamp'],
            defaultVal.toLowerCase()
          )
        ) {
          val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
        } else {
          val_text = quoteWrapper + defaultVal + quoteWrapper;
        }
      } else {
        val_text = quoteWrapper + defaultVal + quoteWrapper;
      }
    }

    return val_text;
  }
}
