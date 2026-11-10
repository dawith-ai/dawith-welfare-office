const toParts = (version) => String(version).split('.').map((part) => Number.parseInt(part, 10) || 0);

export function isNewerVersion(candidate, current) {
  const a = toParts(candidate);
  const b = toParts(current);
  for (let index = 0; index < 3; index += 1) if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0);
  return false;
}

// Installers and latest.yml are published on the product site, so the app
// updates from the same place people download it.
export const updateFeedUrl = 'https://welfare-office.vercel.app/download/';
export const downloadPageUrl = 'https://welfare-office.vercel.app/#download';
