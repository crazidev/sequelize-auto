import { AutoOptions } from '../types';
import { InitStringGenerator } from './base/init-string-generator';
import { V6InitStringGenerator } from './v6-init-generator';
import { V7InitStringGenerator } from './v7-init-generator';

export class InitGeneratorFactory {
  static create(options: AutoOptions): InitStringGenerator {
    const version = options.version || 'v6';

    if (version === 'v7') {
      return new V7InitStringGenerator();
    } else {
      return new V6InitStringGenerator();
    }
  }
}
