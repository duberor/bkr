export function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits,
  }).format(Number(value || 0));
}

export function formatEnergyWh(value) {
  const numeric = Number(value || 0);
  if (numeric >= 1000) {
    return `${formatNumber(numeric / 1000, 2)} kWh`;
  }
  return `${formatNumber(numeric, 0)} Wh`;
}

export function formatPower(value) {
  return `${formatNumber(value, 0)} W`;
}

export function formatBattery(value) {
  return `${formatNumber(value, 0)} Ah`;
}

function getUkrainianDayLabel(value) {
  const absolute = Math.abs(Number(value || 0));
  const rounded = Number(absolute.toFixed(1));

  if (!Number.isInteger(rounded)) {
    return 'доби';
  }

  const lastTwoDigits = rounded % 100;
  const lastDigit = rounded % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'діб';
  }

  if (lastDigit === 1) {
    return 'доба';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'доби';
  }

  return 'діб';
}

export function formatAutonomy(valueHours, options = {}) {
  const numeric = Number(valueHours || 0);
  if (!numeric) return '—';

  const { preferDays = true } = options;
  if (preferDays && numeric >= 24) {
    const days = Number((numeric / 24).toFixed(1));
    return `${formatNumber(days, 1)} ${getUkrainianDayLabel(days)}`;
  }

  return `${formatNumber(numeric, 1)} год`;
}

export function formatBatteryTopology(seriesCount = 1, parallelCount = 1, options = {}) {
  const series = formatNumber(seriesCount, 0);
  const parallel = formatNumber(parallelCount, 0);

  if (options.technical) {
    return `${series}S / ${parallel}P`;
  }

  return `${series} послідовно · ${parallel} паралельно`;
}
