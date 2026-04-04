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

export function formatAutonomy(valueHours, options = {}) {
  const numeric = Number(valueHours || 0);
  if (!numeric) return '—';

  const { preferDays = true } = options;
  if (preferDays && numeric >= 24) {
    return `${formatNumber(numeric / 24, 1)} доби`;
  }

  return `${formatNumber(numeric, 1)} год`;
}
