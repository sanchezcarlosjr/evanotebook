const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  node: { global: true },
  plugins: [new NodePolyfillPlugin()]
};
