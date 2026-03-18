/** @param {import('@azure/functions').Context} context */
module.exports = async function (context, req) {
	const q = req.body?.q;
	if (!q || typeof q !== 'string') {
		context.res = { status: 400, body: 'q is required' };
		return;
	}

	const res = await fetch(process.env.ANALYZE_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id: 1,
			method: 'jlp.maservice.parse',
			params: { q },
		}),
	});

	if (!res.ok) {
		context.res = { status: 502, body: `Analyze API error: ${res.status}` };
		return;
	}

	const data = await res.json();
	context.res = {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data.result?.tokens ?? []),
	};
};
