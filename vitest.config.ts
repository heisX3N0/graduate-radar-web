import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Worktrees live under .claude/worktrees; never run another branch's tests.
    exclude: [...configDefaults.exclude, '.claude/**', 'dist/**'],
  },
});
