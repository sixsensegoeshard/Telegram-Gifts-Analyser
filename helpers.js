import { createHmac } from 'node:crypto';
export function sign(userId = 42, overrides = {}, token = '123456:test-token') {
  const data = { auth_date:String(Math.floor(Date.now()/1000)), user:JSON.stringify({id:userId,first_name:'Тест'}), query_id:'AA_test', ...overrides };
  const secret = createHmac('sha256','WebAppData').update(token).digest();
  const string = Object.entries(data).sort(([a],[b])=>a<b?-1:1).map(([key,value])=>`${key}=${value}`).join('\n');
  data.hash = createHmac('sha256',secret).update(string).digest('hex');
  return new URLSearchParams(data).toString();
}
