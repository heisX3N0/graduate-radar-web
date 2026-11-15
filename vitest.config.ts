import { configDefaults } from 'vitest/config';
import { getViteConfig } from 'astro/config';

// getViteConfig lets tests render .astro components with Astro's container API.
export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Worktrees live under .claude/worktrees; never run another branch's tests.
    exclude: [...configDefaults.exclude, '.claude/**', 'dist/**'],
  },
});
