import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(filename) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, demo_seeded INTEGER DEFAULT 0, alerts_allowed INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS positions(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), gift_id TEXT NOT NULL, gift_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), buy_price REAL NOT NULL CHECK(buy_price>0), purchased_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER NOT NULL REFERENCES users(id), gift_id TEXT NOT NULL, PRIMARY KEY(user_id,gift_id));
      CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), gift_id TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('above','below')), target REAL NOT NULL CHECK(target>0), triggered_at INTEGER, last_error TEXT);
      CREATE TABLE IF NOT EXISTS market_cache(namespace TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots(namespace TEXT NOT NULL, gift_id TEXT NOT NULL, at INTEGER NOT NULL, floor REAL NOT NULL, PRIMARY KEY(namespace,gift_id,at));
      CREATE INDEX IF NOT EXISTS snapshots_lookup ON snapshots(namespace,gift_id,at);
      CREATE TABLE IF NOT EXISTS bot_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      PRAGMA user_version=1;`);
  }
  user(id, name) {
    this.db.prepare('INSERT INTO users(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(id, name);
    return this.db.prepare('SELECT id,name FROM users WHERE id=?').get(id);
  }
  seedDemo() {
    this.user(1, 'Александр');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (!this.db.prepare('SELECT demo_seeded FROM users WHERE id=1').get().demo_seeded) {
        const insert = this.db.prepare('INSERT INTO positions VALUES(?,1,?,?,?,?,?)');
        insert.run('demo-candy', 'candy-cane', 'Candy Cane', 100, 3.1, '2026-10-01');
        insert.run('demo-bear', 'toy-bear', 'Toy Bear', 2, 28, '2026-10-03');
        insert.run('demo-lamp', 'mirage-lamp', 'Mirage Lamp', 5, 4.8, '2026-10-05');
        this.db.prepare('INSERT OR IGNORE INTO favorites VALUES(1,?)').run('toy-bear');
        this.db.exec('UPDATE users SET demo_seeded=1 WHERE id=1');
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  positions(userId) { return this.db.prepare('SELECT id,gift_id AS giftId,gift_name AS giftName,quantity,buy_price AS buyPrice,purchased_at AS purchasedAt FROM positions WHERE user_id=? ORDER BY rowid DESC').all(userId); }
  favorites(userId) { return this.db.prepare('SELECT gift_id AS id FROM favorites WHERE user_id=?').all(userId).map(x => x.id); }
  alerts(userId) { return this.db.prepare('SELECT id,gift_id AS giftId,direction,target,triggered_at AS triggeredAt,last_error AS lastError FROM alerts WHERE user_id=? ORDER BY rowid DESC').all(userId); }
  saveMarket(namespace, gifts, now = Date.now()) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO market_cache VALUES(?,?,?) ON CONFLICT(namespace) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').run(namespace, JSON.stringify(gifts), now);
      const insert = this.db.prepare('INSERT OR IGNORE INTO snapshots VALUES(?,?,?,?)');
      for (const gift of gifts) {
        const floor = Math.min(...gift.markets.map(m => m.floor));
        if (Number.isFinite(floor)) insert.run(namespace, gift.id, gift.updatedAt, floor);
      }
      this.db.prepare('DELETE FROM snapshots WHERE at<?').run(now - 30 * 86400000);
      this.db.exec('COMMIT');
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  cachedMarket(namespace) {
    const row = this.db.prepare('SELECT * FROM market_cache WHERE namespace=?').get(namespace);
    return row ? { gifts: JSON.parse(row.payload), fetchedAt: row.fetched_at } : null;
  }
  history(namespace, id) { return this.db.prepare('SELECT at AS time,floor AS price FROM snapshots WHERE namespace=? AND gift_id=? ORDER BY at').all(namespace, id); }
  close() { this.db.close(); }
}
