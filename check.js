import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const files = ['server.js','bot.js', ...['lib','public','tests','scripts'].flatMap(dir=>readdirSync(dir).filter(name=>name.endsWith('.js')).map(name=>path.join(dir,name)))];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
const frontend=readFileSync('public/app.js','utf8');
if(/\bonclick\s*=|eval\(|new Function\(/.test(frontend))throw new Error('Unsafe frontend script');
console.log(`Syntax checked: ${files.length} JavaScript files`);
