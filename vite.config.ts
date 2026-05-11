import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

const commitCount = (() => {
  try { return execSync('git rev-list --count HEAD').toString().trim(); }
  catch { return '0'; }
})();

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  define: {
    __COMMIT_COUNT__: JSON.stringify(commitCount),
    __BUILD_TIME__:   JSON.stringify(new Date().toISOString()),
  },
});
