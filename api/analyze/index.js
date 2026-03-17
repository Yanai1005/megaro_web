/** @param {import('@azure/functions').Context} context */
module.exports = async function (context, req) {
	const q = req.body?.q;
	if (!q || typeof q !== 'string') {
		context.res = { status: 400, body: 'q is required' };
		return;
	}

	const res = await fetch('https://jlp.yahooapis.jp/MAService/V2/parse', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': `Yahoo AppID: ${process.env.YAHOO_APP_ID}`,
		},
		body: JSON.stringify({
			id: '1',
			jsonrpc: '2.0',
			method: 'jlp.maservice.parse',
			params: { q },
		}),
	});

	if (!res.ok) {
		context.res = { status: 502, body: `Yahoo API error: ${res.status}` };
		return;
	}

	const data = await res.json();
	context.res = {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data.result?.tokens ?? []),
	};
};
