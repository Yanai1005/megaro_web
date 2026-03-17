import { YAHOO_APP_ID } from '$env/static/private';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { q } = await request.json();
	if (!q || typeof q !== 'string') throw error(400, 'q is required');

	const res = await fetch('https://jlp.yahooapis.jp/MAService/V2/parse', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': `Yahoo AppID: ${YAHOO_APP_ID}`,
		},
		body: JSON.stringify({
			id: '1',
			jsonrpc: '2.0',
			method: 'jlp.maservice.parse',
			params: { q },
		}),
	});

	if (!res.ok) throw error(502, `Yahoo API error: ${res.status}`);
	const data = await res.json();
	return json(data.result?.tokens ?? []);
};
