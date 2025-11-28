import { Table } from '../types';

/**
 * Map option table strings to Table objects
 * Option tables are a list of strings; each string is either
 * table name (e.g. "Customer") or schema dot table name (e.g. "dbo.Customer")
 */
export function mapOptionTables(arr: string[], defaultSchema: string | undefined): Table[] {
  return arr.map((t: string) => {
    const sp = t.split('.');
    return {
      table_name: sp[sp.length - 1],
      table_schema: sp.length > 1 ? sp[sp.length - 2] : defaultSchema,
    };
  });
}

/**
 * Compare two Table objects for equality
 */
export function isTableEqual(a: Table, b: Table): boolean {
  return a.table_name === b.table_name && (!b.table_schema || a.table_schema === b.table_schema);
}

/**
 * Create qualified table name (schema.table)
 */
export function makeTableQName(table: Table): string {
  return [table.table_schema, table.table_name].filter(Boolean).join('.');
}
