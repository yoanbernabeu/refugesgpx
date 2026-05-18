import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://refuges.yoandev.co',
  integrations: [react()],
  devToolbar: { enabled: false },
});
