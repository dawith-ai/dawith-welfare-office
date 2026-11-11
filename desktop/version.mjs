const toParts = (version) => String(version).split('.').map((part) => Number.parseInt(part, 10) || 0);

export function isNewerVersion(candidate, current) {
  const a = toParts(candidate);
  const b = toParts(current);
  for (let index = 0; index < 3; index += 1) if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0);
  return false;
}

// Installers and latest.yml are GitHub release assets; releases/latest/download
// always resolves to the newest release, independent of where the site runs.
export const updateFeedUrl = 'https://github.com/dawith-ai/dawith-welfare-office/releases/latest/download/';
export const downloadPageUrl = 'https://welfare-office.vercel.app/#download';
// Release notes shown before updating come from the GitHub release body.
export const releaseNotesUrl = (version) => `https://api.github.com/repos/dawith-ai/dawith-welfare-office/releases/tags/v${version}`;
