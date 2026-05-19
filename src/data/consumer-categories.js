export const CONSUMER_CATEGORIES = [
  { value: 'heating', label: 'Опалення' },
  { value: 'lighting', label: 'Освітлення' },
  { value: 'kitchen_appliance', label: 'Кухонна техніка' },
  { value: 'it_network', label: 'IT / Мережа' },
  { value: 'security', label: 'Безпека' },
  { value: 'water_pump', label: 'Вода / Насоси' },
  { value: 'workstation', label: 'Робоче місце' },
  { value: 'household', label: 'Побутова техніка' },
  { value: 'other', label: 'Інше' },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CONSUMER_CATEGORIES.map((item) => [item.value, item.label]),
);

// Legacy key fallbacks for older projects
CATEGORY_LABELS['kitchen'] = 'Кухня';
CATEGORY_LABELS['network'] = 'Мережа';
CATEGORY_LABELS['heating'] = CATEGORY_LABELS['heating'] || 'Опалення';

