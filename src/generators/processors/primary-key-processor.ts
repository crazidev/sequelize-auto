import { Field } from '../../types';
import { AttributeProcessor } from './attribute-processor';
import { Decorator, FieldAttribute, ProcessorContext } from '../types/model-structure';

export class PrimaryKeyProcessor implements AttributeProcessor {
  canProcess(attrName: string, version: 'v6' | 'v7'): boolean {
    return attrName === 'primaryKey';
  }

  process(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): FieldAttribute | null {
    if (attrValue === true && (!fieldObj.foreignKey || !!fieldObj.foreignKey.isPrimaryKey)) {
      return {
        name: 'primaryKey',
        value: true,
        format: 'v6',
      };
    }
    return null;
  }

  getDecorators(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): Decorator[] | undefined {
    if (attrValue === true && (!fieldObj.foreignKey || !!fieldObj.foreignKey.isPrimaryKey)) {
      return [
        {
          name: 'PrimaryKey',
        },
      ];
    }
    return undefined;
  }
}
