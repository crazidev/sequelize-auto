import _ from 'lodash';
import { Relation } from '../../types';
import { pluralize, qNameJoin, qNameSplit, recase, singularize } from '../../utils/GeneratorUtils';
import { GeneratorContext, GeneratorOptions } from '../IGenerator';
import { AssociationResult, IRelationGenerator } from './IComponentGenerator';

/**
 * Abstract base class for relation generation
 */
export abstract class BaseRelationGenerator implements IRelationGenerator {
  abstract generateTSMixins(context: GeneratorContext, table: string): AssociationResult;
  abstract generateAssociations(relations: Relation[], options: GeneratorOptions): string;

  generate(context: GeneratorContext, table: string): string {
    const result = this.generateTSMixins(context, table);
    return result.str;
  }

  /**
   * Add schema to table so it will match the relation data.
   * Fixes mysql problem where schema is not included in table names.
   */
  protected addSchemaForRelations(table: string, relations: Relation[]): string {
    if (!table.includes('.') && !relations.some((rel) => rel.childTable === table)) {
      // if no tables match the given table, then assume we need to fix the schema
      const first = relations.find((rel) => !!rel.childTable);
      if (first) {
        const [schemaName] = qNameSplit(first.childTable);
        if (schemaName) {
          table = qNameJoin(schemaName, table);
        }
      }
    }
    return table;
  }
}

/**
 * V6 Relation Generator - Sequelize v6 style associations with mixins
 */
export class V6RelationGenerator extends BaseRelationGenerator {
  generateTSMixins(context: GeneratorContext, table: string): AssociationResult {
    const sp = context.space[1];
    const needed: Record<string, Set<string>> = {};
    let str = '';
    const mixinMode = context.options.associationMixins || 'all';

    table = this.addSchemaForRelations(table, context.relations);

    context.relations.forEach((rel) => {
      if (!rel.isM2M) {
        if (rel.childTable === table) {
          // current table is a child that belongsTo parent
          str += this.generateBelongsToMixins(sp, rel, needed, mixinMode);
        } else if (rel.parentTable === table) {
          if (rel.isOne) {
            str += this.generateHasOneMixins(sp, rel, needed, mixinMode);
          } else {
            str += this.generateHasManyMixins(sp, rel, needed, mixinMode);
          }
        }
      } else {
        // rel.isM2M
        if (rel.parentTable === table) {
          str += this.generateBelongsToManyMixins(sp, rel, needed, mixinMode);
        }
      }
    });

    if (needed[table]) {
      delete needed[table]; // don't add import for self
    }

    return { needed, str };
  }

  private generateBelongsToMixins(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>,
    mixinMode: 'all' | 'property' | 'none'
  ): string {
    let str = '';
    const pparent = _.upperFirst(rel.parentProp);

    str += `${sp}// ${rel.childModel} belongsTo ${rel.parentModel} via ${rel.parentId}\n`;

    if (mixinMode !== 'none') {
      str += `${sp}declare ${rel.parentProp}: ${rel.parentModel};\n`;
    }

    if (mixinMode === 'all') {
      str += `${sp}declare get${pparent}: Sequelize.BelongsToGetAssociationMixin<${rel.parentModel}>;\n`;
      str += `${sp}declare set${pparent}: Sequelize.BelongsToSetAssociationMixin<${rel.parentModel}, ${rel.parentModel}Id>;\n`;
      str += `${sp}declare create${pparent}: Sequelize.BelongsToCreateAssociationMixin<${rel.parentModel}>;\n`;
    }

    needed[rel.parentTable] ??= new Set();
    needed[rel.parentTable].add(rel.parentModel);
    if (mixinMode === 'all') {
      needed[rel.parentTable].add(rel.parentModel + 'Id');
    }

    return str;
  }

  private generateHasOneMixins(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>,
    mixinMode: 'all' | 'property' | 'none'
  ): string {
    let str = '';
    const pchild = _.upperFirst(rel.childProp);

    needed[rel.childTable] ??= new Set();

    str += `${sp}// ${rel.parentModel} hasOne ${rel.childModel} via ${rel.parentId}\n`;

    if (mixinMode !== 'none') {
      str += `${sp}declare ${rel.childProp}: ${rel.parentId};\n`;
    }

    if (mixinMode === 'all') {
      str += `${sp}declare get${pchild}: Sequelize.HasOneGetAssociationMixin<${rel.childModel}>;\n`;
      str += `${sp}declare set${pchild}: Sequelize.HasOneSetAssociationMixin<${rel.childModel}, ${rel.childModel}Id>;\n`;
      str += `${sp}declare create${pchild}: Sequelize.HasOneCreateAssociationMixin<${rel.childModel}>;\n`;
    }

    needed[rel.childTable].add(rel.childModel);
    if (mixinMode === 'all') {
      needed[rel.childTable].add(`${rel.childModel}Id`);
      needed[rel.childTable].add(`${rel.childModel}CreationAttributes`);
    }

    return str;
  }

  private generateHasManyMixins(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>,
    mixinMode: 'all' | 'property' | 'none'
  ): string {
    let str = '';
    const hasModel = rel.childModel;
    const sing = _.upperFirst(singularize(rel.childProp));
    const lur = pluralize(rel.childProp);
    const plur = _.upperFirst(lur);

    needed[rel.childTable] ??= new Set();

    str += `${sp}// ${rel.parentModel} hasMany ${rel.childModel} via ${rel.parentId}\n`;

    if (mixinMode !== 'none') {
      str += `${sp}declare ${lur}: ${rel.childModel}[];\n`;
    }

    if (mixinMode === 'all') {
      str += `${sp}declare get${plur}: Sequelize.HasManyGetAssociationsMixin<${hasModel}>;\n`;
      str += `${sp}declare set${plur}: Sequelize.HasManySetAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
      str += `${sp}declare add${sing}: Sequelize.HasManyAddAssociationMixin<${hasModel}, ${hasModel}Id>;\n`;
      str += `${sp}declare add${plur}: Sequelize.HasManyAddAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
      str += `${sp}declare create${sing}: Sequelize.HasManyCreateAssociationMixin<${hasModel}>;\n`;
      str += `${sp}declare remove${sing}: Sequelize.HasManyRemoveAssociationMixin<${hasModel}, ${hasModel}Id>;\n`;
      str += `${sp}declare remove${plur}: Sequelize.HasManyRemoveAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
      str += `${sp}declare has${sing}: Sequelize.HasManyHasAssociationMixin<${hasModel}, ${hasModel}Id>;\n`;
      str += `${sp}declare has${plur}: Sequelize.HasManyHasAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
      str += `${sp}declare count${plur}: Sequelize.HasManyCountAssociationsMixin;\n`;
    }

    needed[rel.childTable].add(hasModel);
    if (mixinMode === 'all') {
      needed[rel.childTable].add(`${hasModel}Id`);
    }

    return str;
  }

  private generateBelongsToManyMixins(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>,
    mixinMode: 'all' | 'property' | 'none'
  ): string {
    let str = '';
    const isParent = rel.parentTable === rel.parentTable; // always true in this context
    const thisModel = rel.parentModel;
    const otherModel = rel.childModel;
    const otherModelSingular = _.upperFirst(singularize(rel.childProp));
    const lotherModelPlural = pluralize(rel.childProp);
    const otherModelPlural = _.upperFirst(lotherModelPlural);
    const otherTable = rel.childTable;

    str += `${sp}// ${thisModel} belongsToMany ${otherModel} via ${rel.parentId} and ${rel.childId}\n`;

    if (mixinMode !== 'none') {
      str += `${sp}declare ${lotherModelPlural}: ${otherModel}[];\n`;
    }

    if (mixinMode === 'all') {
      str += `${sp}declare get${otherModelPlural}: Sequelize.BelongsToManyGetAssociationsMixin<${otherModel}>;\n`;
      str += `${sp}declare set${otherModelPlural}: Sequelize.BelongsToManySetAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
      str += `${sp}declare add${otherModelSingular}: Sequelize.BelongsToManyAddAssociationMixin<${otherModel}, ${otherModel}Id>;\n`;
      str += `${sp}declare add${otherModelPlural}: Sequelize.BelongsToManyAddAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
      str += `${sp}declare create${otherModelSingular}: Sequelize.BelongsToManyCreateAssociationMixin<${otherModel}>;\n`;
      str += `${sp}declare remove${otherModelSingular}: Sequelize.BelongsToManyRemoveAssociationMixin<${otherModel}, ${otherModel}Id>;\n`;
      str += `${sp}declare remove${otherModelPlural}: Sequelize.BelongsToManyRemoveAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
      str += `${sp}declare has${otherModelSingular}: Sequelize.BelongsToManyHasAssociationMixin<${otherModel}, ${otherModel}Id>;\n`;
      str += `${sp}declare has${otherModelPlural}: Sequelize.BelongsToManyHasAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
      str += `${sp}declare count${otherModelPlural}: Sequelize.BelongsToManyCountAssociationsMixin;\n`;
    }

    needed[otherTable] ??= new Set();
    needed[otherTable].add(otherModel);
    if (mixinMode === 'all') {
      needed[otherTable].add(`${otherModel}Id`);
    }

    return str;
  }

  generateAssociations(relations: Relation[], options: GeneratorOptions): string {
    let strBelongs = '';
    let strBelongsToMany = '';
    const sp = '  '; // Single indent

    relations.forEach((rel) => {
      if (rel.isM2M) {
        const asprop = recase(options.caseProp, pluralize(rel.childProp));
        strBelongsToMany += `${sp}${rel.parentModel}.belongsToMany(${rel.childModel}, { as: '${asprop}', through: ${rel.joinModel}, foreignKey: "${rel.parentId}", otherKey: "${rel.childId}" });\n`;
      } else {
        const asParentProp = recase(options.caseProp, rel.parentProp);
        const bAlias = options.noAlias ? '' : `as: "${asParentProp}", `;
        strBelongs += `${sp}${rel.childModel}.belongsTo(${rel.parentModel}, { ${bAlias}foreignKey: "${rel.parentId}"});\n`;

        const hasRel = rel.isOne ? 'hasOne' : 'hasMany';
        const asChildProp = recase(options.caseProp, rel.childProp);
        const hAlias = options.noAlias ? '' : `as: "${asChildProp}", `;
        strBelongs += `${sp}${rel.parentModel}.${hasRel}(${rel.childModel}, { ${hAlias}foreignKey: "${rel.parentId}"});\n`;
      }
    });

    // belongsToMany must come first
    return strBelongsToMany + strBelongs;
  }
}

/**
 * V7 Relation Generator - Sequelize v7 style associations with decorators
 */
export class V7RelationGenerator extends BaseRelationGenerator {
  generateTSMixins(context: GeneratorContext, table: string): AssociationResult {
    const sp = context.space[1];
    const needed: Record<string, Set<string>> = {};
    let str = '';

    table = this.addSchemaForRelations(table, context.relations);

    context.relations.forEach((rel) => {
      if (!rel.isM2M) {
        if (rel.childTable === table) {
          // current table is a child that belongsTo parent
          str += this.generateBelongsToDecorator(sp, rel, needed);
        } else if (rel.parentTable === table) {
          if (rel.isOne) {
            str += this.generateHasOneDecorator(sp, rel, needed);
          } else {
            str += this.generateHasManyDecorator(sp, rel, needed);
          }
        }
      } else {
        // rel.isM2M
        if (rel.parentTable === table) {
          str += this.generateBelongsToManyDecorator(sp, rel, needed);
        }
      }
    });

    if (needed[table]) {
      delete needed[table]; // don't add import for self
    }

    return { needed, str };
  }

  private generateBelongsToDecorator(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>
  ): string {
    let str = '';

    str += `${sp}// ${rel.childModel} belongsTo ${rel.parentModel} via ${rel.parentId}\n`;
    str +=
      sp +
      `@BelongsTo(() => ${rel.parentModel}, { foreignKey: '${rel.parentId}', inverse: { as: '${
        rel.parentProp
      }', type: '${rel.isOne ? 'hasOne' : 'hasMany'}' }})\n`;
    str += sp + `declare ${rel.parentProp}?: NonAttribute<${rel.parentModel}>\n\n`;

    needed[rel.parentTable] ??= new Set();
    needed[rel.parentTable].add(rel.parentModel);

    return str;
  }

  private generateHasOneDecorator(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>
  ): string {
    let str = '';

    needed[rel.childTable] ??= new Set();

    str += `${sp}// ${rel.parentModel} hasOne ${rel.childModel} via ${rel.parentId}\n`;
    str +=
      sp +
      `@HasOne(() => ${rel.childModel}, { foreignKey: '${rel.parentId}', inverse: { as: '${rel.childProp}' }})\n`;
    str += sp + `declare ${rel.childProp}?: NonAttribute<${rel.childModel}>\n\n`;

    needed[rel.childTable].add(rel.childModel);

    return str;
  }

  private generateHasManyDecorator(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>
  ): string {
    let str = '';

    needed[rel.childTable] ??= new Set();

    str += `${sp}// ${rel.parentModel} hasMany ${rel.childModel} via ${rel.parentId}\n`;
    str +=
      sp +
      `@HasMany(() => ${rel.childModel}, { foreignKey: '${rel.parentId}', inverse: { as: '${rel.childProp}' } })\n`;
    str += sp + `declare ${rel.childProp}?: NonAttribute<${rel.childModel}[]>\n\n`;

    needed[rel.childTable].add(rel.childModel);

    return str;
  }

  private generateBelongsToManyDecorator(
    sp: string,
    rel: Relation,
    needed: Record<string, Set<string>>
  ): string {
    let str = '';
    const otherModel = rel.childModel;
    const otherTable = rel.childTable;

    str += `${sp}// ${rel.parentModel} belongsToMany ${otherModel} via ${rel.parentId} and ${rel.childId}\n`;
    str += `${sp}@BelongsToMany(() => ${otherModel}, { through: ()=> ${rel.joinModel}, foreignKey: '${rel.parentId}', inverse:  { as: '${rel.childProp}'}, otherKey: '${rel.childId}', })\n`;
    str += sp + `declare ${rel.childProp}?: NonAttribute<${otherModel}[]>\n\n`;

    needed[otherTable] ??= new Set();
    needed[otherTable].add(otherModel);

    return str;
  }

  generateAssociations(relations: Relation[], options: GeneratorOptions): string {
    // V7 with decorators handles associations via decorators, not runtime code
    // Return empty string as associations are defined in the model class
    return '';
  }
}
