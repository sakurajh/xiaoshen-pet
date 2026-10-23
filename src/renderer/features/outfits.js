export const DEFAULT_OUTFIT = 'sweater';

export const OUTFITS = [
  {
    id: 'sweater',
    name: '浅灰卫衣',
    detail: '舒服',
    previewClass: 'sweater',
    bubble: '还是卫衣舒服。今天在桌面窝着吧。'
  },
  {
    id: 'plaid',
    name: '蓝粉格衬衫',
    detail: '精神',
    previewClass: 'plaid',
    bubble: '格衬衫穿上啦。看起来像要去开组会。'
  },
  {
    id: 'windbreakerLilac',
    name: '香芋紫冲锋衣',
    detail: '户外',
    previewClass: 'windbreaker-lilac',
    bubble: '香芋紫冲锋衣配米色工装裤，今天适合出门走走。'
  },
  {
    id: 'windbreakerNavy',
    name: '雾蓝冲锋衣',
    detail: '清爽',
    previewClass: 'windbreaker-navy',
    bubble: '换上雾蓝冲锋衣，帽子和风都准备好了。'
  },
  {
    id: 'windbreakerBlack',
    name: '黑灰紫冲锋衣',
    detail: '夜色',
    previewClass: 'windbreaker-black',
    bubble: '黑灰紫冲锋衣也好看。帽子一戴，像要去夜跑。'
  },
  {
    id: 'crabTee',
    name: '白蟹印花长袖',
    detail: '散步',
    previewClass: 'crab-tee',
    bubble: '白长袖配藏青半裙。胸口的红蟹是今天的主角。'
  },
  {
    id: 'crabCargo',
    name: '白蟹工装搭',
    detail: '轻便',
    previewClass: 'crab-cargo',
    bubble: '白蟹长袖换了条米色工装裤，今天是轻松出门路线。'
  },
  {
    id: 'blackTop',
    name: '黑色交叉上衣',
    detail: '约会',
    previewClass: 'black-top',
    bubble: '黑色交叉领配米色长裤。这样出门，应该会被多看一眼。'
  }
];

export const OUTFIT_IDS = new Set(OUTFITS.map((outfit) => outfit.id));
export const OUTFIT_BY_ID = new Map(OUTFITS.map((outfit) => [outfit.id, outfit]));

export function isValidOutfit(id) {
  return OUTFIT_IDS.has(id);
}

export function normalizeOutfit(id) {
  return isValidOutfit(id) ? id : DEFAULT_OUTFIT;
}

export function getOutfit(id) {
  return OUTFIT_BY_ID.get(normalizeOutfit(id)) || OUTFITS[0];
}

export function getOutfitBubble(id) {
  return getOutfit(id).bubble;
}
