import { ColumnDescription } from 'sequelize/types';
import { DialectOptions, FKSpec } from '../../dialects/dialect-options';
import { Field } from '../../types';
import { Decorator, FieldAttribute, ProcessorContext } from '../types/model-structure';

/**
 * Base interface for attribute processors
 * Each processor handles a specific field attribute (primaryKey, defaultValue, etc.)
 */
export interface AttributeProcessor {
  /**
   * Check if this processor can handle the given attribute
   */
  canProcess(attrName: string, version: 'v6' | 'v7'): boolean;

  /**
   * Process the attribute for v6 format (returns FieldAttribute)
   */
  process(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): FieldAttribute | null;

  /**
   * Get decorators for v7 format (returns Decorator[])
   */
  getDecorators?(
    fieldObj: Field,
    attrName: string,
    attrValue: any,
    context: ProcessorContext
  ): Decorator[] | undefined;
}
