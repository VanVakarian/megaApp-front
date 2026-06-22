const path = require('path');
const webpack = require('webpack');
const childProcess = require('child_process');
const fs = require('fs');
const https = require('https');

const getLatestGitCommitHash = () => {
  try {
    return childProcess.execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
};

const getLatestGitCommitDateTime = () => {
  try {
    const timestamp = childProcess.execSync('git show -s --format=%ci HEAD').toString().trim();
    return new Date(timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' });
  } catch (e) {
    return 'unknown';
  }
};

// making a file in assets that shows the latest commit hash, and date-time of both front and back upon build
class BuildInfoPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('BuildInfoPlugin', () => {
      const buildInfo = `
        const frontInfo = {
          commitHash: "${getLatestGitCommitHash()}",
          commitDateTime: "${getLatestGitCommitDateTime()}"
        };

        let backendInfo = {
          commitHash: "unknown",
          commitDateTime: "unknown"
        };

        fetch('/api/debug/commit-info')
          .then(response => response.json())
          .then(data => {
            backendInfo = data;
          })
          .catch(() => {})
          .finally(() => {
            console.log("Latest front commit: [" + frontInfo.commitHash + ", " + frontInfo.commitDateTime + "]");
            console.log("Latest back commit: [" + backendInfo.commitHash + ", " + backendInfo.commitDateTime + "]");
          });
      `;
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
