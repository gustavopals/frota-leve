module.exports = {
  extends: ['../../.eslintrc.js'],
  env: {
    browser: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'coverage/', '.angular/'],
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@angular-eslint/recommended',
        'plugin:@angular-eslint/template/process-inline-templates',
      ],
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.spec.json'],
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
        '@angular-eslint/component-class-suffix': 'off',
        '@angular-eslint/prefer-inject': 'off',
        '@angular-eslint/prefer-standalone': 'off',
      },
    },
    {
      files: ['*.html'],
      extends: ['plugin:@angular-eslint/template/recommended'],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
