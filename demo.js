// Fixed illustrations and fixtures. These are never loaded in live mode.
const rows = [
  ['candy-cane', 'Candy Cane', 'cane', 3.8, 3.96, 8.6, 324, 1256, 4.04],
  ['toy-bear', 'Toy Bear', 'bear', 31.4, 32.0, 4.7, 186, 5934, 32.8],
  ['loot-bag', 'Loot Bag', 'bag', 64, 67.2, 10.3, 93, 6269, 69.1],
  ['durovs-cap', "Durov’s Cap", 'cap', 540, 568, 8, 42, 23128, 558],
  ['kissed-frog', 'Kissed Frog', 'frog', 39.64, 41.8, 0.2, 147, 6040, 40.6],
  ['ion-gem', 'Ion Gem', 'gem', 61.12, 64.4, -1.8, 71, 4510, 62.3],
  ['mirage-lamp', 'Mirage Lamp', 'lamp', 5.36, 6.0, 5, 288, 1583, 5.72],
  ['heart-locket', 'Heart Locket', 'heart', 118, 124.4, -4.8, 38, 4640, 121],
  ['plush-pepe', 'Plush Pepe', 'frog', 2450, 2578, 2.9, 12, 29628, 2494],
  ['vice-cream', 'Vice Cream', 'icecream', 3.37, 3.72, -2.1, 294, 1032, 3.41],
  ['clover-pin', 'Clover Pin', 'clover', 4.52, 4.86, 3.2, 218, 1014, 4.74],
  ['snoop-dogg', 'Snoop Dogg', 'cap', 4.9, 5.08, -3.9, 302, 1560, 5.12],
];

export function demoGifts(now = Date.now()) {
  return rows.map(([id, name, art, floor, other, change24h, sales24h, volume24h, avgSale24h], index) => ({
    id, name, art, updatedAt: now, change24h, sales24h, volume24h, avgSale24h,
    markets: [{ name: 'Portals', floor, listings: 32 + index * 7 }, { name: 'MRKT', floor: other, listings: 28 + index * 6 }],
    history: Array.from({ length: 49 }, (_, i) => ({ time: now - (48 - i) * 3600000, price: Number((floor / (1 + change24h / 100) + (floor - floor / (1 + change24h / 100)) * (i - 24) / 24 + Math.sin(i * 0.9 + index) * floor * .009 * (i === 48 || i === 24 ? 0 : 1)).toFixed(4)) })),
    traits: index === 1 ? [{ type: 'Модель', name: 'Wizard', floor: 28.4, sales: 14 }, { type: 'Фон', name: 'Onyx Black', floor: 29, sales: 11 }, { type: 'Узор', name: 'Star', floor: 28.8, sales: 12 }] : [],
  }));
}
