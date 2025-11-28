import { Field } from '../../types';
import { AttributeProcessor } from './attribute-processor';
import { Decorator, FieldAttribute, ProcessorContext } from '../types/model-structure';

export class ForeignKeyProcessor implements AttributeProcessor {
  canProcess(attrName: string, version: 'v6' | 'v7'): boolean {
    return attrName === 'foreignKey' || attrName === 'references';
  }

  process(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): FieldAttribute | null {
    // For v6, foreign keys are handled via references attribute
    if (context.version === 'v6' && attrName === 'foreignKey' && context.foreignKey?.isForeignKey) {
      return {
        name: 'references',
        value: {
          model: context.foreignKey.foreignSources.target_table,
          key: context.foreignKey.foreignSources.target_column,
        },
        format: 'v6',
      };
    }
    // For v7, foreign keys are handled via association decorators, not field attributes
    return null;
  }

  getDecorators(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): Decorator[] | undefined {
    // For v7, foreign keys are handled via association decorators, not field decorators
    return undefined;
  }
}
