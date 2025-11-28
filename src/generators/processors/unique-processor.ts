import _ from 'lodash';
import { Field } from '../../types';
import { AttributeProcessor } from './attribute-processor';
import { Decorator, FieldAttribute, ProcessorContext } from '../types/model-structure';

export class UniqueProcessor implements AttributeProcessor {
  canProcess(attrName: string, version: 'v6' | 'v7'): boolean {
    return attrName === 'unique';
  }

  process(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): FieldAttribute | null {
    // This processor handles the unique attribute from fieldObj.unique
    // which is set separately from field attributes
    return null; // Handled separately in field building
  }

  getDecorators(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): Decorator[] | undefined {
    // This is called with the unique value from fieldObj.unique
    if (attrValue) {
      const uniq = _.isString(attrValue)
        ? '"' + attrValue.replace(/\"/g, '\\"') + '"'
        : attrValue;
      return [
        {
          name: 'Unique',
          arguments: uniq === true ? undefined : [uniq],
        },
      ];
    }
    return undefined;
  }
}
