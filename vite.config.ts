import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * kuromoji の辞書ファイル (.dat.gz) は kuromoji 自身が gunzip するため、
 * ブラウザに Content-Encoding: gzip を渡すと自動解凍されて二重解凍になる。
 * sirv に渡す前に自前で配信し、Content-Encoding を付けないようにする。
 */
const serveDictRaw: Plugin = {
	name: 'serve-dict-raw',
	enforce: 'pre',
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			const m = req.url?.match(/^\/dict\/([\w.]+\.dat\.gz)(\?.*)?$/);
			if (!m) { next(); return; }
			try {
				const data = readFileSync(resolve(__dirname, 'static/dict', m[1]));
				res.writeHead(200, {
					'Content-Type': 'application/octet-stream',
					'Content-Length': data.length,
					'Cache-Control': 'public, max-age=86400'
				});
				res.end(data);
			} catch {
				next();
			}
		});
	}
};

const devAnalyzeProxy: Plugin = {
	name: 'dev-analyze-proxy',
	configureServer(server) {
		const env = loadEnv('development', process.cwd(), '');
		const analyzeUrl = env.VITE_ANALYZE_API_URL ?? env.ANALYZE_API_URL ?? '';
		server.middlewares.use('/api/analyze', async (req, res) => {
			if (!analyzeUrl) {
				res.writeHead(503, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'ANALYZE_API_URL not set' }));
				return;
			}
			const chunks: Buffer[] = [];
			req.on('data', (c: Buffer) => chunks.push(c));
			req.on('end', async () => {
				try {
					const body = JSON.parse(Buffer.concat(chunks).toString());
					const upstream = await fetch(analyzeUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id: 1, method: 'jlp.maservice.parse', params: { q: body.q } }),
					});
					const data = await upstream.json() as { result?: { tokens?: unknown } };
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify(data.result?.tokens ?? []));
				} catch (e) {
					res.writeHead(502, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: String(e) }));
				}
			});
		});
	}
};

export default defineConfig({
	plugins: [serveDictRaw, devAnalyzeProxy, tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			// kuromoji src は Node.js の path/fs に依存するため、
			// ブラウザ向けの browserify 済みビルドを使用する
			kuromoji: resolve(__dirname, 'node_modules/kuromoji/build/kuromoji.js')
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
