/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // desabilita regras do ESLint que conflitam com o Prettier
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Proíbe uso de `any` explícito
    '@typescript-eslint/no-explicit-any': 'error',
    // Variáveis não utilizadas — prefixar com _ para ignorar
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // Preferir const quando a variável não é reatribuída
    'prefer-const': 'error',
    // Retorno consistente nas funções
    'consistent-return': 'error',
    // console.log em código de produção é warning — usar logger
    'no-console': 'warn',
    // Importações sem tipo devem usar `import type`
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    // Não permitir non-null assertions desnecessárias
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', '.turbo/', '**/*.js', '!.eslintrc.js'],
};
