const WEATHER_MAP = {
  0: { text: '晴', icon: 'sun' },
  1: { text: '大致晴朗', icon: 'sun' },
  2: { text: '多云', icon: 'cloud-sun' },
  3: { text: '阴', icon: 'cloud' },
  45: { text: '有雾', icon: 'cloud' },
  48: { text: '雾凇', icon: 'cloud' },
  51: { text: '小毛毛雨', icon: 'rain' },
  53: { text: '毛毛雨', icon: 'rain' },
  55: { text: '较强毛毛雨', icon: 'rain' },
  56: { text: '冻毛毛雨', icon: 'rain' },
  57: { text: '强冻毛毛雨', icon: 'rain' },
  61: { text: '小雨', icon: 'rain' },
  63: { text: '中雨', icon: 'rain' },
  65: { text: '大雨', icon: 'rain' },
  66: { text: '冻雨', icon: 'rain' },
  67: { text: '强冻雨', icon: 'rain' },
  71: { text: '小雪', icon: 'snow' },
  73: { text: '中雪', icon: 'snow' },
  75: { text: '大雪', icon: 'snow' },
  77: { text: '雪粒', icon: 'snow' },
  80: { text: '阵雨', icon: 'rain' },
  81: { text: '强阵雨', icon: 'rain' },
  82: { text: '暴雨', icon: 'rain' },
  85: { text: '阵雪', icon: 'snow' },
  86: { text: '强阵雪', icon: 'snow' },
  95: { text: '雷阵雨', icon: 'storm' },
  96: { text: '雷阵雨伴冰雹', icon: 'storm' },
  99: { text: '强雷阵雨伴冰雹', icon: 'storm' }
};

export function describeWeather(code) {
  return WEATHER_MAP[Number(code)] || { text: '天气变化中', icon: 'cloud' };
}

export function weatherAdvice(data) {
  if (!data?.ok) return '';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(Number(data.weatherCode))) {
    return '出门记得带伞。';
  }
  if ([71, 73, 75, 77, 85, 86].includes(Number(data.weatherCode))) {
    return '外面下雪，注意保暖和路滑。';
  }
  if (Number(data.temperature) >= 32) return '有点热，记得补水和防晒。';
  if (Number(data.temperature) <= 5) return '外面很冷，加件外套。';
  if (Number(data.wind) >= 30) return '风有点大，出门注意。';
  return '';
}

export function buildWeatherPayload(settings) {
  return {
    city: settings?.city || '西安',
    lat: Number(settings?.lat) || 34.26,
    lon: Number(settings?.lon) || 108.94
  };
}
