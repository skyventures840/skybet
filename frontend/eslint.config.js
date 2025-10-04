const js = require("@eslint/js");
const react = require("eslint-plugin-react");

module.exports = [
  {
    ...js.configs.recommended,
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        // Node.js globals
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        // Browser globals
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        performance: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        DOMException: "readonly",
        AbortController: "readonly",
        MessageChannel: "readonly",
        WebSocket: "readonly",
        queueMicrotask: "readonly",
        alert: "readonly",
        // React globals
        React: "readonly",
        __REACT_DEVTOOLS_GLOBAL_HOOK__: "readonly"
      }
    },
    plugins: {
      react
    },
    rules: {
      ...js.configs.recommended.rules,
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-vars": "error",
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
    files: ["**/*.jsx", "src/**/*.js"],
    languageOptions: {
      parser: require("@babel/eslint-parser"),
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [
            require.resolve("@babel/preset-env"),
            require.resolve("@babel/preset-react")
          ]
        },
        ecmaFeatures: {
          jsx: true
        }
      }
    }
  }
];