import { browser } from '$app/environment';
import kuromoji from 'kuromoji';

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

let tokenizer: Tokenizer | null = null;
let initPromise: Promise<void> | null = null;

export function initKuromoji(): Promise<void> {
	if (!browser) return Promise.resolve();
	if (tokenizer) return Promise.resolve();
	if (initPromise) return initPromise;

	initPromise = new Promise<void>((resolve, reject) => {
		kuromoji.builder({ dicPath: '/dict' }).build((err, t) => {
			if (err) {
				console.warn('[kana] kuromoji init failed, using katakana-only fallback:', err);
				initPromise = null; // allow retry on next call
				reject(err);
			} else {
				tokenizer = t;
				resolve();
			}
		});
	});
	return initPromise;
}

export const isKuromojiReady = () => tokenizer !== null;

/** カタカナ → ひらがな */
export function toHiragana(text: string): string {
	return text.replace(/[\u30A1-\u30F6]/g, (c) =>
		String.fromCharCode(c.charCodeAt(0) - 0x60)
	);
}
export function isValidSiritoriWord(word: string): boolean {
	if (!tokenizer) return true;
	const body = word.match(/^([^(（]+)/)?.[1]?.trimEnd() ?? word;
	const tokens = tokenizer.tokenize(body);
	if (tokens.length === 0) return false;
	for (const token of tokens) {
		if (token.pos === '助詞' || token.pos === '助動詞') return false;
		if (token.pos === '記号') return false;
	}
	return true;
}



export function getHiraganaReading(text: string): string {
	if (!tokenizer) return toHiragana(text);

	const tokens = tokenizer.tokenize(text);
	const reading = tokens.map((t) => t.reading ?? t.surface_form).join('');
	return toHiragana(reading);
}

export function isKnownWord(word: string): boolean {
	if (!tokenizer) return true;
	if (word.match(/[(（][ぁ-ん]+[)）]$/)) return true;
	const body = word.match(/^([^(（]+)/)?.[1]?.trimEnd() ?? word;
	const tokens = tokenizer.tokenize(body);
	if (tokens.length === 0) return false;
	return tokens.every((t) => t.reading !== undefined && t.reading !== '');
}