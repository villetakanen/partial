import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'@shared': resolve('src/shared'),
			'@main': resolve('src/main'),
			'@renderer': resolve('src/renderer'),
		},
	},
	test: {
		globals: false,
		include: ['tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist', 'e2e'],
		coverage: {
			provider: 'v8',
			reportsDirectory: 'coverage',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.d.ts', 'src/**/*.test.ts'],
		},
	},
})
