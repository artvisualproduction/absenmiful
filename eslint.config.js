import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'api/_bundle.mjs', 'node_modules/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
