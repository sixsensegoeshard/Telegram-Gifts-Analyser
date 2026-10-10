import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

const database = path.resolve(process.env.DB_PATH || './data/gifts.sqlite');
const target = process.argv[2];
if (!target) throw new Error('Usage: node --env-file-if-exists=.env scripts/backup.js /private/path/backup.sqlite');
const destination = path.resolve(target);
if (database === destination) throw new Error('Backup path must differ from database');
mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
const db = new DatabaseSync(database,{readOnly:true});
try { await backup(db,destination);chmodSync(destination,0o600);console.log('SQLite backup completed'); }
finally { db.close(); }
