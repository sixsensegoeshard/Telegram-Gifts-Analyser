const round = (v,d=2) => Math.round((v+Number.EPSILON)*10**d)/10**d;
export function resaleScenario(price, target, { buyFee = 0, sellFee = 5, transfer = 0, undercut = 1 } = {}) {
  if (![price,target,buyFee,sellFee,transfer,undercut].every(Number.isFinite) || price <= 0 || target <= 0 || buyFee < 0 || buyFee > 100 || sellFee < 0 || sellFee >= 100 || transfer < 0 || undercut < 0 || undercut >= 100) return null;
  const entry = price * (1+buyFee/100) + transfer;
  const exit = target * (1-undercut/100);
  const net = exit*(1-sellFee/100)-entry;
  return { entry:round(entry,4), exit:round(exit,4), net:round(net,4), roi:round(net/entry*100), breakEven:round(entry/(1-sellFee/100),4), assumptions:{buyFee,sellFee,transfer,undercut}, executable:false };
}

