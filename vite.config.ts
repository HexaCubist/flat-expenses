import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { cjsInterop } from 'vite-plugin-cjs-interop';

export default defineConfig({
	plugins: [
		cjsInterop({
			dependencies: ['@haverstack/axios-fetch-adapter']
		}),
		sveltekit()
	]
});
