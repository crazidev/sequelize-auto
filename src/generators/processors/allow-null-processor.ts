import { Field } from '../../types';
import { AttributeProcessor } from './attribute-processor';
import { Decorator, FieldAttribute, ProcessorContext } from '../types/model-structure';

export class AllowNullProcessor implements AttributeProcessor {
  canProcess(attrName: string, version: 'v6' | 'v7'): boolean {
    return attrName === 'allowNull';
  }

  process(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): FieldAttribute | null {
    return {
      name: 'allowNull',
      value: attrValue,
      format: 'v6',
    };
  }

  getDecorators(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): Decorator[] | undefined {
    // Only add @NotNull decorator when allowNull is false
    if (attrValue === false) {
      return [
        {
          name: 'NotNull',
        },
      ];
    }
    return undefined;
  }
}
