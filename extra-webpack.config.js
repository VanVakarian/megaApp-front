const path = require('path');
const webpack = require('webpack');
const childProcess = require('child_process');
const fs = require('fs');

const getGitInfo = () => {
  try {
    return childProcess.execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
};

class BuildInfoPlugin {
  // making a file in assets with frontend app build info
  apply(compiler) {
    compiler.hooks.done.tap('BuildInfoPlugin', () => {
      const buildInfo = `console.log("Commit: [${getGitInfo()}] built at [${new Date().toLocaleTimeString()}]");`;
      fs.writeFileSync('./src/assets/build-info.js', buildInfo);
    });
  }
}

module.exports = {
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, '@app/'),
    },
  },
  plugins: [new BuildInfoPlugin()],
};
