/* eslint-env node */
module.exports = {
    root: true,
    extends: ['expo', 'prettier'],
    ignorePatterns: ['node_modules', '.expo', 'dist', 'babel.config.js', 'metro.config.js'],
    globals: {
        // React Native / Hermes provides these; ESLint doesn't know about them.
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        __DEV__: 'readonly',
    },
    rules: {
        // Metro resolves imports at build time; ESLint's Node resolver cannot follow RN/Expo modules.
        'import/no-unresolved': 'off',
    },
};