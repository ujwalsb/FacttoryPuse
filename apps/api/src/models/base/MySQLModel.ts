import { v4 as uuidv4 } from 'uuid';
import { getPool, isDBConnected } from '../../config/db.js';

export interface ModelOptions {
  tableName: string;
  jsonColumns?: string[];
  dateColumns?: string[];
  numberColumns?: string[];
  booleanColumns?: string[];
}

export class ModelRegistry {
  private static models = new Map<string, typeof MySQLModel>();

  static register(name: string, model: typeof MySQLModel): void {
    this.models.set(name, model);
  }

  static get(name: string): typeof MySQLModel | undefined {
    return this.models.get(name);
  }
}

export class QueryChain<T = any> implements PromiseLike<T> {
  private filter: any = {};
  private sortFields: Record<string, 1 | -1 | 'asc' | 'desc'> = {};
  private limitCount?: number;
  private skipCount?: number;
  private selectFields?: string | Record<string, any>;
  private populateFields: Array<{ path: string; select?: string }> = [];
  private isLean = false;
  private isSingle = false;
  private model: typeof MySQLModel;

  constructor(model: typeof MySQLModel, filter: any = {}, isSingle = false) {
    this.model = model;
    this.filter = filter || {};
    this.isSingle = isSingle;
  }

  select(fields: string | Record<string, any>): this {
    this.selectFields = fields;
    return this;
  }

  sort(sortObj: Record<string, 1 | -1 | 'asc' | 'desc'>): this {
    this.sortFields = { ...this.sortFields, ...sortObj };
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  skip(n: number): this {
    this.skipCount = n;
    return this;
  }

  populate(path: string, select?: string): this {
    this.populateFields.push({ path, select });
    return this;
  }

  lean(): this {
    this.isLean = true;
    return this;
  }

  async exec(): Promise<any> {
    const results = await this.model.executeQuery({
      filter: this.filter,
      sort: this.sortFields,
      limit: this.limitCount,
      skip: this.skipCount,
      isSingle: this.isSingle
    });

    if (this.isSingle) {
      if (!results || results.length === 0) return null;
      let item = results[0];
      if (this.populateFields.length > 0) {
        item = await this.model.populateRecord(item, this.populateFields);
      }
      if (this.selectFields) {
        item = this.model.applySelect(item, this.selectFields);
      }
      return this.isLean ? (item.toObject ? item.toObject() : item) : item;
    }

    let populated = results;
    if (this.populateFields.length > 0) {
      populated = await Promise.all(
        results.map((r: any) => this.model.populateRecord(r, this.populateFields))
      );
    }

    if (this.selectFields) {
      populated = populated.map((r: any) => this.model.applySelect(r, this.selectFields!));
    }

    if (this.isLean) {
      return populated.map((r: any) => (r.toObject ? r.toObject() : r));
    }
    return populated;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

export class UpdateQueryChain<T = any> implements PromiseLike<T> {
  private model: typeof MySQLModel;
  private filter: any;
  private update: any;
  private options: any;
  private selectFields?: string | Record<string, any>;

  constructor(model: typeof MySQLModel, filter: any, update: any, options: any = {}) {
    this.model = model;
    this.filter = filter;
    this.update = update;
    this.options = options;
  }

  select(fields: string | Record<string, any>): this {
    this.selectFields = fields;
    return this;
  }

  async exec(): Promise<any> {
    const item = await this.model.findOne(this.filter);
    if (!item) return null;

    const updates = this.update.$set || this.update;
    for (const [k, v] of Object.entries(updates)) {
      item[k] = v;
    }
    await item.save();

    if (this.selectFields) {
      return this.model.applySelect(item, this.selectFields);
    }
    return item;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

export class MySQLModel {
  static tableName: string;
  static jsonColumns: string[] = [];
  static dateColumns: string[] = ['createdAt', 'updatedAt'];
  static inMemoryStore: Map<string, any> = new Map();

  [key: string]: any;
  id!: string;
  _id!: string;
  createdAt?: Date;
  updatedAt?: Date;
  private _isNew = true;

  constructor(data: any = {}) {
    const modelClass = this.constructor as typeof MySQLModel;
    const clean = modelClass.deserializeRow(data);
    Object.assign(this, clean);

    const rawId = clean.id || clean._id || uuidv4();
    this.id = rawId.toString();
    this._id = this.id;
    this._isNew = !data.id && !data._id;
  }

  toObject(): any {
    const copy: any = {};
    for (const [key, value] of Object.entries(this)) {
      if (key.startsWith('_') && key !== '_id') continue;
      if (typeof value === 'function') continue;
      copy[key] = value;
    }
    copy._id = this.id;
    copy.id = this.id;
    return copy;
  }

  toJSON(): any {
    return this.toObject();
  }

  async save(): Promise<this> {
    const modelClass = this.constructor as typeof MySQLModel;
    this.updatedAt = new Date();
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    this._id = this.id;

    const row = this.toObject();
    await modelClass.upsertRecord(row);
    this._isNew = false;
    return this;
  }

  static applySelect(doc: any, select: string | Record<string, any>): any {
    const plain = doc.toObject ? doc.toObject() : { ...doc };

    if (typeof select === 'string') {
      const tokens = select.split(/\s+/).filter(Boolean);
      const exclusions = tokens.filter(t => t.startsWith('-')).map(t => t.slice(1));
      const inclusions = tokens.filter(t => !t.startsWith('-') && !t.startsWith('+'));

      if (exclusions.length > 0) {
        for (const ex of exclusions) {
          delete plain[ex];
        }
        return doc.toObject ? new (this as any)(plain) : plain;
      }

      if (inclusions.length > 0) {
        const out: any = { id: plain.id, _id: plain.id };
        for (const inc of inclusions) {
          if (plain[inc] !== undefined) {
            out[inc] = plain[inc];
          }
        }
        return doc.toObject ? new (this as any)(out) : out;
      }
    } else if (typeof select === 'object') {
      const keys = Object.keys(select);
      const isExclusion = keys.some(k => select[k] === 0 || select[k] === false);
      if (isExclusion) {
        for (const k of keys) {
          if (select[k] === 0 || select[k] === false) {
            delete plain[k];
          }
        }
        return doc.toObject ? new (this as any)(plain) : plain;
      }

      const out: any = { id: plain.id, _id: plain.id };
      for (const k of keys) {
        if (select[k]) {
          out[k] = plain[k];
        }
      }
      return doc.toObject ? new (this as any)(out) : out;
    }

    return doc;
  }

  static async upsertRecord(data: any): Promise<any> {
    const id = (data.id || data._id || uuidv4()).toString();
    data.id = id;
    data._id = id;

    const pool = getPool();
    if (pool && isDBConnected()) {
      const serialized = this.serializeRow(data);
      delete serialized._id;

      const keys = Object.keys(serialized);
      const values = Object.values(serialized);
      const placeholders = keys.map(() => '?').join(', ');
      const updateClause = keys
        .filter(k => k !== 'id' && k !== 'createdAt')
        .map(k => `\`${k}\` = VALUES(\`${k}\`)`)
        .join(', ');

      const sql = `INSERT INTO \`${this.tableName}\` (${keys.map(k => `\`${k}\``).join(', ')})
                   VALUES (${placeholders})
                   ON DUPLICATE KEY UPDATE ${updateClause || 'id=id'};`;

      await pool.query(sql, values);
    }

    // Always mirror to in-memory store
    this.inMemoryStore.set(id, { ...data });
    return new this(data);
  }

  static serializeRow(data: any): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith('_') && key !== '_id') continue;
      if (val === undefined) continue;

      if (key === '_id') {
        out.id = val ? val.toString() : uuidv4();
        continue;
      }

      if (this.jsonColumns.includes(key)) {
        out[key] = val !== null ? JSON.stringify(val) : null;
      } else if (val instanceof Date) {
        out[key] = val.toISOString().slice(0, 23).replace('T', ' ');
      } else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        out[key] = JSON.stringify(val);
      } else {
        out[key] = val;
      }
    }
    return out;
  }

  static deserializeRow(row: any): any {
    if (!row) return null;
    const out: any = {};
    for (const [key, val] of Object.entries(row)) {
      if (this.jsonColumns.includes(key)) {
        if (typeof val === 'string') {
          try {
            out[key] = JSON.parse(val);
          } catch {
            out[key] = val;
          }
        } else {
          out[key] = val;
        }
      } else if (this.dateColumns.includes(key) && val) {
        out[key] = new Date(val as any);
      } else {
        out[key] = val;
      }
    }
    if (out.id && !out._id) {
      out._id = out.id;
    }
    return out;
  }

  static find(filter: any = {}, projection?: any): QueryChain<any[]> {
    const chain = new QueryChain<any[]>(this, filter, false);
    if (projection) {
      chain.select(projection);
    }
    return chain;
  }

  static findOne(filter: any = {}, projection?: any): QueryChain<any> {
    const chain = new QueryChain<any>(this, filter, true);
    if (projection) {
      chain.select(projection);
    }
    return chain;
  }

  static findById(id: any, projection?: any): QueryChain<any> {
    const cleanId = id ? (id.toString ? id.toString() : String(id)) : '';
    const chain = new QueryChain<any>(this, { id: cleanId }, true);
    if (projection) {
      chain.select(projection);
    }
    return chain;
  }

  static findOneAndUpdate(filter: any, update: any, options: any = {}): UpdateQueryChain<any> {
    return new UpdateQueryChain(this, filter, update, options);
  }

  static async findOneAndDelete(filter: any): Promise<any> {
    const item = await this.findOne(filter);
    if (!item) return null;
    await this.deleteOne(filter);
    return item;
  }

  static async create(data: any | any[]): Promise<any> {
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.create(item)));
    }
    const clean = { ...data };
    const id = clean.id || clean._id || uuidv4();
    clean.id = id.toString();
    clean._id = clean.id;
    clean.createdAt = clean.createdAt || new Date();
    clean.updatedAt = clean.updatedAt || new Date();

    const doc = new this(clean);
    await doc.save();
    return doc;
  }

  static async countDocuments(filter: any = {}): Promise<number> {
    const pool = getPool();
    if (pool && isDBConnected()) {
      const { sqlWhere, params } = this.buildWhereClause(filter);
      const sql = `SELECT COUNT(*) as total FROM \`${this.tableName}\` ${sqlWhere};`;
      const [rows] = await pool.query<any[]>(sql, params);
      return Number(rows[0]?.total || 0);
    }

    // In-memory fallback
    const items = Array.from(this.inMemoryStore.values());
    return items.filter(item => this.matchesFilter(item, filter)).length;
  }

  static async distinct(field: string, filter: any = {}): Promise<any[]> {
    const safeField = field.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeField) return [];
    const pool = getPool();
    if (pool && isDBConnected()) {
      const { sqlWhere, params } = this.buildWhereClause(filter);
      const sql = `SELECT DISTINCT \`${safeField}\` as val FROM \`${this.tableName}\` ${sqlWhere} AND \`${safeField}\` IS NOT NULL;`;
      const [rows] = await pool.query<any[]>(sql, params);
      return rows.map((r: any) => r.val).filter(Boolean);
    }

    const items = Array.from(this.inMemoryStore.values()).filter(item =>
      this.matchesFilter(item, filter)
    );
    const set = new Set(items.map(i => i[field]).filter(Boolean));
    return Array.from(set);
  }

  static async deleteOne(filter: any = {}): Promise<{ deletedCount: number }> {
    const pool = getPool();
    if (pool && isDBConnected()) {
      const { sqlWhere, params } = this.buildWhereClause(filter);
      const sql = `DELETE FROM \`${this.tableName}\` ${sqlWhere} LIMIT 1;`;
      const [result]: any = await pool.query(sql, params);
      return { deletedCount: result?.affectedRows || 0 };
    }

    for (const [id, item] of this.inMemoryStore.entries()) {
      if (this.matchesFilter(item, filter)) {
        this.inMemoryStore.delete(id);
        return { deletedCount: 1 };
      }
    }
    return { deletedCount: 0 };
  }

  static async deleteMany(filter: any = {}): Promise<{ deletedCount: number }> {
    const pool = getPool();
    if (pool && isDBConnected()) {
      const { sqlWhere, params } = this.buildWhereClause(filter);
      const sql = `DELETE FROM \`${this.tableName}\` ${sqlWhere};`;
      const [result]: any = await pool.query(sql, params);
      return { deletedCount: result?.affectedRows || 0 };
    }

    let count = 0;
    if (Object.keys(filter).length === 0) {
      count = this.inMemoryStore.size;
      this.inMemoryStore.clear();
      return { deletedCount: count };
    }
    for (const [id, item] of this.inMemoryStore.entries()) {
      if (this.matchesFilter(item, filter)) {
        this.inMemoryStore.delete(id);
        count++;
      }
    }
    return { deletedCount: count };
  }

  static async findByIdAndDelete(id: any): Promise<any> {
    const cleanId = id ? id.toString() : '';
    const item = await this.findById(cleanId);
    if (!item) return null;
    await this.deleteOne({ id: cleanId });
    return item;
  }

  static async updateOne(filter: any, update: any): Promise<{ modifiedCount: number }> {
    const item = await this.findOne(filter);
    if (!item) return { modifiedCount: 0 };

    const updates = update.$set || update;
    for (const [k, v] of Object.entries(updates)) {
      item[k] = v;
    }
    await item.save();
    return { modifiedCount: 1 };
  }

  static async updateMany(filter: any, update: any): Promise<{ modifiedCount: number }> {
    const items = await this.find(filter);
    const updates = update.$set || update;
    let count = 0;
    for (const item of items) {
      for (const [k, v] of Object.entries(updates)) {
        item[k] = v;
      }
      await item.save();
      count++;
    }
    return { modifiedCount: count };
  }

  static findByIdAndUpdate(id: any, update: any, options: any = {}): UpdateQueryChain<any> {
    const cleanId = id ? (id.toString ? id.toString() : String(id)) : '';
    return new UpdateQueryChain(this, { id: cleanId }, update, options);
  }

  static async executeQuery(options: {
    filter: any;
    sort?: Record<string, 1 | -1 | 'asc' | 'desc'>;
    limit?: number;
    skip?: number;
    isSingle?: boolean;
  }): Promise<any[]> {
    const { filter, sort, limit, skip, isSingle } = options;
    const pool = getPool();

    if (pool && isDBConnected()) {
      const { sqlWhere, params } = this.buildWhereClause(filter);
      let sql = `SELECT * FROM \`${this.tableName}\` ${sqlWhere}`;

      if (sort && Object.keys(sort).length > 0) {
        const orderClauses = Object.entries(sort)
          .map(([field, dir]) => {
            const cleanField = (field === '_id' ? 'id' : field).replace(/[^a-zA-Z0-9_]/g, '');
            if (!cleanField) return '';
            const direction = dir === 1 || dir === 'asc' ? 'ASC' : 'DESC';
            return `\`${cleanField}\` ${direction}`;
          })
          .filter(Boolean);
        if (orderClauses.length > 0) {
          sql += ` ORDER BY ${orderClauses.join(', ')}`;
        }
      }

      if (isSingle) {
        sql += ' LIMIT 1';
      } else if (limit) {
        sql += ` LIMIT ${Number(limit)}`;
        if (skip) {
          sql += ` OFFSET ${Number(skip)}`;
        }
      }

      const [rows]: any = await pool.query(sql, params);
      return (rows || []).map((r: any) => new this(this.deserializeRow(r)));
    }

    // In-memory fallback
    let items = Array.from(this.inMemoryStore.values())
      .filter(item => this.matchesFilter(item, filter))
      .map(item => new this(item));

    if (sort && Object.keys(sort).length > 0) {
      items.sort((a, b) => {
        for (const [field, dir] of Object.entries(sort)) {
          const cleanField = field === '_id' ? 'id' : field;
          const valA = a[cleanField];
          const valB = b[cleanField];
          const multiplier = dir === 1 || dir === 'asc' ? 1 : -1;
          if (valA < valB) return -1 * multiplier;
          if (valA > valB) return 1 * multiplier;
        }
        return 0;
      });
    }

    if (skip) items = items.slice(skip);
    if (limit) items = items.slice(0, limit);
    if (isSingle) items = items.slice(0, 1);

    return items;
  }

  static async populateRecord(
    record: any,
    populates: Array<{ path: string; select?: string }>
  ): Promise<any> {
    for (const { path, select } of populates) {
      const refVal = record[path];
      if (!refVal) continue;

      const refModel = this.inferRefModel(path);
      if (!refModel) continue;

      if (Array.isArray(refVal)) {
        const ids = refVal.map((v: any) => (v ? (v.id || v._id || v).toString() : null)).filter(Boolean);
        const docs = await refModel.find({ id: { $in: ids } });
        record[path] = docs.map((d: any) => this.selectPopulatedFields(d, select));
      } else {
        const id = (refVal.id || refVal._id || refVal).toString();
        const doc = await refModel.findById(id);
        if (doc) {
          record[path] = this.selectPopulatedFields(doc, select);
        }
      }
    }
    return record;
  }

  private static inferRefModel(path: string): typeof MySQLModel | undefined {
    const mapping: Record<string, string> = {
      tenantId: 'Tenant',
      plantId: 'Plant',
      lineId: 'ProductionLine',
      gatewayId: 'Gateway',
      machineId: 'Machine',
      assignedMachines: 'Machine',
      assignedToUserId: 'User',
      ruleId: 'AlertRule',
      actorId: 'User',
      requestedByUserId: 'User'
    };
    const target = mapping[path];
    return target ? ModelRegistry.get(target) : undefined;
  }

  private static selectPopulatedFields(doc: any, select?: string): any {
    const plain = doc.toObject ? doc.toObject() : { ...doc };
    if (!select) return plain;

    const fields = select.split(/\s+/).filter(Boolean);
    const result: any = { id: plain.id, _id: plain._id || plain.id };
    for (const f of fields) {
      if (plain[f] !== undefined) {
        result[f] = plain[f];
      }
    }
    return result;
  }

  static buildWhereClause(filter: any): { sqlWhere: string; params: any[]; clauses: string[] } {
    if (!filter || Object.keys(filter).length === 0) {
      return { sqlWhere: 'WHERE 1=1', params: [], clauses: [] };
    }

    const clauses: string[] = [];
    const params: any[] = [];

    for (const [key, val] of Object.entries(filter)) {
      if (key === '$or' && Array.isArray(val)) {
        const orClauses: string[] = [];
        for (const subFilter of val) {
          const sub = this.buildWhereClause(subFilter);
          if (sub.clauses && sub.clauses.length > 0) {
            orClauses.push(`(${sub.clauses.join(' AND ')})`);
            params.push(...sub.params);
          }
        }
        if (orClauses.length > 0) {
          clauses.push(`(${orClauses.join(' OR ')})`);
        }
        continue;
      }

      const col = (key === '_id' ? 'id' : key).replace(/[^a-zA-Z0-9_]/g, '');
      if (!col) continue;

      if (val === null || val === undefined) {
        clauses.push(`\`${col}\` IS NULL`);
      } else if (typeof val === 'boolean') {
        clauses.push(`\`${col}\` = ?`);
        params.push(val ? 1 : 0);
      } else if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        const objVal = val as Record<string, any>;
        if ('$in' in objVal && Array.isArray(objVal.$in)) {
          if (objVal.$in.length === 0) {
            clauses.push('1=0');
          } else {
            const placeholders = objVal.$in.map(() => '?').join(', ');
            clauses.push(`\`${col}\` IN (${placeholders})`);
            params.push(...objVal.$in.map((v: any) => typeof v === 'boolean' ? (v ? 1 : 0) : (v ? v.toString() : v)));
          }
        } else if ('$nin' in objVal && Array.isArray(objVal.$nin)) {
          if (objVal.$nin.length > 0) {
            const placeholders = objVal.$nin.map(() => '?').join(', ');
            clauses.push(`\`${col}\` NOT IN (${placeholders})`);
            params.push(...objVal.$nin.map((v: any) => typeof v === 'boolean' ? (v ? 1 : 0) : (v ? v.toString() : v)));
          }
        } else if ('$regex' in objVal) {
          clauses.push(`\`${col}\` LIKE ?`);
          params.push(`%${objVal.$regex}%`);
        } else if ('$ne' in objVal) {
          if (objVal.$ne === null) {
            clauses.push(`\`${col}\` IS NOT NULL`);
          } else if (typeof objVal.$ne === 'boolean') {
            clauses.push(`\`${col}\` != ?`);
            params.push(objVal.$ne ? 1 : 0);
          } else {
            clauses.push(`\`${col}\` != ?`);
            params.push(objVal.$ne);
          }
        } else if ('$gt' in objVal) {
          clauses.push(`\`${col}\` > ?`);
          params.push(objVal.$gt);
        } else if ('$gte' in objVal) {
          clauses.push(`\`${col}\` >= ?`);
          params.push(objVal.$gte);
        } else if ('$lt' in objVal) {
          clauses.push(`\`${col}\` < ?`);
          params.push(objVal.$lt);
        } else if ('$lte' in objVal) {
          clauses.push(`\`${col}\` <= ?`);
          params.push(objVal.$lte);
        } else if ('$exists' in objVal) {
          clauses.push(objVal.$exists ? `\`${col}\` IS NOT NULL` : `\`${col}\` IS NULL`);
        } else {
          // Plain object comparison (e.g. nested subdocument)
          clauses.push(`\`${col}\` = ?`);
          params.push(JSON.stringify(objVal));
        }
      } else if (val instanceof Date) {
        clauses.push(`\`${col}\` = ?`);
        params.push(val.toISOString().slice(0, 23).replace('T', ' '));
      } else {
        clauses.push(`\`${col}\` = ?`);
        params.push(val.toString ? val.toString() : val);
      }
    }

    const sqlWhere = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : 'WHERE 1=1';
    return { sqlWhere, params, clauses };
  }

  static matchesFilter(item: any, filter: any): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;

    for (const [key, val] of Object.entries(filter)) {
      if (key === '$or' && Array.isArray(val)) {
        const matchesAny = val.some(sub => this.matchesFilter(item, sub));
        if (!matchesAny) return false;
        continue;
      }

      const itemVal = key === '_id' ? (item.id || item._id) : item[key];

      if (val === null || val === undefined) {
        if (itemVal !== null && itemVal !== undefined) return false;
      } else if (typeof val === 'boolean') {
        const itemBool = itemVal === undefined ? false : Boolean(itemVal);
        if (itemBool !== val) return false;
      } else if (typeof val === 'object' && !(val instanceof Date)) {
        const objVal = val as Record<string, any>;
        if ('$in' in objVal && Array.isArray(objVal.$in)) {
          const strList = objVal.$in.map((x: any) => (x ? x.toString() : x));
          if (!strList.includes(itemVal ? itemVal.toString() : itemVal)) return false;
        } else if ('$regex' in objVal) {
          const pattern = String(objVal.$regex || '');
          const flags = typeof objVal.$options === 'string' ? objVal.$options : '';
          const reg = new RegExp(pattern, flags);
          if (!reg.test(String(itemVal || ''))) return false;
        } else if ('$ne' in objVal) {
          if (itemVal === objVal.$ne) return false;
        } else if ('$gte' in objVal) {
          if (Number(itemVal) < Number(objVal.$gte)) return false;
        } else if ('$lte' in objVal) {
          if (Number(itemVal) > Number(objVal.$lte)) return false;
        } else if ('$gt' in objVal) {
          if (Number(itemVal) <= Number(objVal.$gt)) return false;
        } else if ('$lt' in objVal) {
          if (Number(itemVal) >= Number(objVal.$lt)) return false;
        }
      } else {
        const left = itemVal ? itemVal.toString() : itemVal;
        const right = val ? val.toString() : val;
        if (left !== right) return false;
      }
    }
    return true;
  }
}
