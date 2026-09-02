// Root server.cjs wrapper for PM2 and production deployment
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

if (!process.env.PORT) {
  process.env.PORT = '8081';
}

const targetDist = path.join(__dirname, 'dist', 'server.cjs');

if (!fs.existsSync(targetDist)) {
  console.log('[Server Wrapper] dist/server.cjs not found. Automatically triggering build...');
  try {
    cp.execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('[Server Wrapper] Automatic build failed:', err);
  }
}

if (fs.existsSync(targetDist)) {
  require(targetDist);
} else {
  console.error('[Server Wrapper] Error: dist/server.cjs could not be located or built.');
  process.exit(1);
}
