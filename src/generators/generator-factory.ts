import { DialectOptions } from '../dialects/dialect-options';
import { AutoOptions } from '../types';
import { V6Generator } from './v6-generator';
import { V7Generator } from './v7-generator';

export class GeneratorFactory {
  static create(dialect: DialectOptions, options: AutoOptions): V6Generator | V7Generator {
    const version = options.version || 'v6';

    if (version === 'v7') {
      return new V7Generator(dialect, options);
    } else {
      return new V6Generator(dialect, options);
    }
  }
}
