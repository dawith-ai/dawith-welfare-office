import { test as base, expect } from '@playwright/test';

// Must match CONSENT_POLICY_VERSION in public/toolbox.js.
export const consentPolicyVersion = '2026-11-10';

export function acceptedConsent({ externalAi = true, updatedAt = '2026-11-10T00:00:00.000Z' } = {}) {
  const agreed = { agreed: true, at: updatedAt };
  return { policyVersion: consentPolicyVersion, privacy: agreed, terms: agreed, externalAi: externalAi ? agreed : { agreed: false, at: null }, updatedAt };
}

// Tool tests start from a PC where the first-run setup is already done, so no
// blocking dialog covers the workspace. The setup flow has its own spec.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((record) => {
      if (!localStorage.getItem('dawith-consent-v1')) localStorage.setItem('dawith-consent-v1', JSON.stringify(record));
    }, acceptedConsent());
    await use(page);
  },
});

export { expect };
