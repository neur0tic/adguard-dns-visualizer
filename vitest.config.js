import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    env: {
      NODE_ENV: 'test',
      ADGUARD_URL: 'http://fake',
      ADGUARD_USERNAME: 'testuser',
      ADGUARD_PASSWORD: 'testpass'
    }
  }
});
