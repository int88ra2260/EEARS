'use strict';

const { isMissingFrontendAssetPath } = require('../utils/spaAssetFallback');

describe('isMissingFrontendAssetPath', () => {
  test('treats hashed frontend chunks as assets', () => {
    expect(isMissingFrontendAssetPath('/assets/StudentProgressPage-11ZwMPDs.js')).toBe(true);
    expect(isMissingFrontendAssetPath('/assets/app.css')).toBe(true);
  });

  test('treats other static files as assets', () => {
    expect(isMissingFrontendAssetPath('/favicon.ico')).toBe(true);
    expect(isMissingFrontendAssetPath('/uploads/photo.png')).toBe(true);
  });

  test('leaves application routes for the SPA shell', () => {
    expect(isMissingFrontendAssetPath('/student/progress')).toBe(false);
    expect(isMissingFrontendAssetPath('/admin/operations/406')).toBe(false);
    expect(isMissingFrontendAssetPath('/')).toBe(false);
  });
});
