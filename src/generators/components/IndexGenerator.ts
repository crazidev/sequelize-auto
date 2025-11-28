import { GeneratorContext } from '../IGenerator';
import { IIndexGenerator } from './IComponentGenerator';

/**
 * Abstract base class for index generation
 */
export abstract class BaseIndexGenerator implements IIndexGenerator {
  abstract generateIndexes(context: GeneratorContext, table: string): string;

  generate(context: GeneratorContext, table: string): string {
    if (context.options.noIndexes) {
      return '';
    }
    return this.generateIndexes(context, table);
  }
}

/**
 * V6 Index Generator - Sequelize v6 style index definitions
 */
export class V6IndexGenerator extends BaseIndexGenerator {
  generateIndexes(context: GeneratorContext, table: string): string {
    if (context.options.noIndexes) {
      return '';
    }

    const indexes = context.indexes[table];
    const space = context.space;
    let str = '';

    if (indexes && indexes.length) {
      str += space[2] + 'indexes: [\n';

      indexes.forEach((idx) => {
        str += space[3] + '{\n';

        if (idx.name) {
          str += space[4] + `name: "${idx.name}",\n`;
        }

        if (idx.unique) {
          str += space[4] + 'unique: true,\n';
        }

        if (idx.type) {
          if (['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(idx.type)) {
            str += space[4] + `type: "${idx.type}",\n`;
          } else {
            str += space[4] + `using: "${idx.type}",\n`;
          }
        }

        str += space[4] + `fields: [\n`;

        idx.fields.forEach((ff) => {
          str += space[5] + `{ name: "${ff.attribute}"`;

          if (ff.collate) {
            str += `, collate: "${ff.collate}"`;
          }

          if (ff.length) {
            str += `, length: ${ff.length}`;
          }

          if (ff.order && ff.order !== 'ASC') {
            str += `, order: "${ff.order}"`;
          }

          str += ' },\n';
        });

        str += space[4] + ']\n';
        str += space[3] + '},\n';
      });

      str += space[2] + '],\n';
    }

    return str;
  }
}

/**
 * V7 Index Generator - Sequelize v7 style index definitions
 * Note: V7 indexes work similarly to V6, but may use decorators in the future
 */
export class V7IndexGenerator extends BaseIndexGenerator {
  generateIndexes(context: GeneratorContext, table: string): string {
    // V7 currently uses the same index format as V6
    // Future versions may use @Index decorator
    const v6Generator = new V6IndexGenerator();
    return v6Generator.generateIndexes(context, table);
  }

  /**
   * Generate index decorators for V7 (future use)
   * Currently not fully implemented in Sequelize v7 decorators
   */
  generateIndexDecorators(context: GeneratorContext, table: string): string {
    if (context.options.noIndexes) {
      return '';
    }

    const indexes = context.indexes[table];
    const space = context.space;
    let str = '';

    // TODO: When Sequelize v7 supports @Index decorators, implement here
    // For now, indexes are handled via model options

    return str;
  }
}
