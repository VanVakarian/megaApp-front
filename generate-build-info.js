const { execSync } = require('child_process');
const fs = require('fs');

const getLatestGitCommitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
};

const getLatestGitCommitDateTime = () => {
  try {
    const timestamp = execSync('git show -s --format=%ci HEAD').toString().trim();
    return new Date(timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });
  } catch (e) {
    return 'unknown';
  }
};

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
console.log('Build info generated successfully');
