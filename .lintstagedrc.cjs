/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{ts,tsx,js,jsx,cjs,mjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
