import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["CHANGELOG.md"],
    sortImports: {},
    sortTailwindcss: {
      stylesheet: "./apps/zhongwen/app/assets/css/main.css",
      functions: ["cn", "clsx"],
    },
  },
  staged: {
    "*.{js,ts,tsx,vue,svelte}": "vp check --fix",
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      curly: "error",
    },
  },
});
