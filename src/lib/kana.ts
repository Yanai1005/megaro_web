export function toHiragana(text: string): string {
	return text.replace(/[\u30A1-\u30F6]/g, (c) =>
		String.fromCharCode(c.charCodeAt(0) - 0x60)
	);
}

export async function warmupApi(): Promise<void> {
	for (let i = 0; i < 12; i++) {
		try {
			const res = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ q: 'あ' }),
				signal: AbortSignal.timeout(8000),
			});
			if (res.ok) return;
		} catch {}
		await new Promise<void>((r) => setTimeout(r, 5000));
	}
	throw new Error('API warmup failed');
}

export async function analyzeText(text: string): Promise<string[][]> {
	const res = await fetch('/api/analyze', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ q: text }),
	});
	if (!res.ok) throw new Error(`Analyze API error: ${res.status}`);
	return res.json();
}

/** トークン配列からひらがな読みを取得する */
export function getReadingFromTokens(tokens: string[][]): string {
	return toHiragana(tokens.map((t) => t[1] ?? t[0]).join(''));
}

const INVALID_POS = new Set(['助詞', '助動詞', '記号', '接続詞', '連体詞', '形容詞', '形容動詞', '副詞', '感動詞', 'フィラー', 'その他']);

/** しりとりに使える単語か（文章でないか）チェック */
export function isValidSiritoriWordFromTokens(tokens: string[][]): boolean {
	if (tokens.length === 0) return false;
	return !tokens.some((t) =>
		(t.length > 3 && INVALID_POS.has(t[3])) ||
		(t.length > 4 && t[4] === '接尾')
	);
}

export function isKnownWordFromTokens(tokens: string[][]): boolean {
	if (tokens.length !== 1) return false;
	return tokens[0][1] != null && tokens[0][1] !== '';
}

/** 日本語（ひらがな・カタカナ・漢字）を含む単語か確認する */
const JAPANESE_RE = /[\u3041-\u309E\u30A1-\u30F4\u4E00-\u9FBF]/;

export function isJapaneseFromTokens(tokens: string[][]): boolean {
	if (tokens.length === 0) return false;
	return tokens.some((t) => JAPANESE_RE.test(t[0]));
}