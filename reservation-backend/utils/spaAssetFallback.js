const ASSET_EXTENSION = /\.(?:js|mjs|css|map|woff2?|ttf|eot|png|jpe?g|gif|webp|svg|ico|txt|json|webmanifest)$/i;

/**
 * 這些路徑是建置產物。檔案不存在時要回 404，不能改送 index.html，
 * 否則瀏覽器會把 HTML 當成 JavaScript 模組而載入失敗。
 */
function isMissingFrontendAssetPath(pathname) {
  const pathOnly = String(pathname || '').split('?')[0];
  if (pathOnly.startsWith('/assets/')) return true;
  return ASSET_EXTENSION.test(pathOnly);
}

module.exports = {
  isMissingFrontendAssetPath,
};
