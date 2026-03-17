import { compile, execute } from '$lib/bf.js';
import {
	analyzeText,
	getReadingFromTokens,
	isValidSiritoriWordFromTokens,
	isKnownWordFromTokens,
	isJapaneseFromTokens,
} from '$lib/kana.js';
import { PLAYER_COLORS, type Player, type Turn } from '$lib/types.js';

const wordBody   = (w: string) => w.match(/^([^(（]+)/)?.[1]?.trimEnd() ?? w;
const chars      = (s: string) => [...s];
const firstChar  = (s: string) => chars(s)[0] ?? '';
const lastChar   = (s: string) => { const c = chars(s); return c[c.length - 1] ?? ''; };
const isHiragana = (c: string) => { const cp = c.codePointAt(0) ?? 0; return cp >= 0x3041 && cp <= 0x309e; };

export class GameState {
	currentPlayer = $state<Player>(1);
	inputWord     = $state('');
	challengeBf   = $state('');
	expectedChar  = $state('');
	error         = $state('');
	history       = $state<Turn[]>([]);
	gameOver      = $state(false);
	loser         = $state<Player | null>(null);
	lossReason    = $state('');
	hintVisible   = $state(false);
	hintResult    = $state('');
	submitting    = $state(false);

	round     = $derived(this.history.length + 1);
	usedWords = $derived(new Set(this.history.map((h) => wordBody(h.word))));

	get playerColor() { return PLAYER_COLORS[this.currentPlayer]; }

	async handleSubmit() {
		if (this.submitting) return;
		const word = this.inputWord.trim();
		this.inputWord = '';
		this.error = '';
		if (!word) { this.error = '単語を入力してください'; return; }

		const manual = word.match(/[(（]([ぁ-ん]+)[)）]$/);
		const body = wordBody(word);
		if ([...body].length < 2) { this.error = '2文字以上の単語を入力してください'; return; }

		this.submitting = true;
		let tokens: string[][];
		try {
			tokens = await analyzeText(body);
		} catch {
			this.error = '解析に失敗しました。もう一度お試しください';
			this.submitting = false;
			return;
		}
		this.submitting = false;

		const reading = manual ? manual[1] : getReadingFromTokens(tokens);

		if (!isJapaneseFromTokens(tokens)) {
			this.error = '日本語の単語を入力してください'; return;
		}
		if (!isValidSiritoriWordFromTokens(tokens)) {
			this.error = '文章は使えません。単語を入力してください'; return;
		}
		if (!manual && !isKnownWordFromTokens(tokens)) {
			this.error = '辞書に見つかりません。実在する単語か「単語(よみ)」の形で入力してください'; return;
		}
		if (this.expectedChar && firstChar(reading) !== this.expectedChar) {
			this.error = `Brainfuck を解読すると… 「${this.expectedChar}」から始まる単語を入力してください`; return;
		}
		if (this.usedWords.has(body)) {
			this.history = [...this.history, { player: this.currentPlayer, word, reading }];
			this.endGame(this.currentPlayer, `「${body}」はすでに使われた単語です`);
			return;
		}
		const last = lastChar(reading);
		if (!isHiragana(last)) {
			this.error = '読みを取得できませんでした。「東京(とうきょう)」のように括弧で読みを付けてください'; return;
		}
		if (last === 'ん') {
			this.history = [...this.history, { player: this.currentPlayer, word, reading }];
			this.endGame(this.currentPlayer, `「${reading}」で終わる単語を言いました`);
			return;
		}

		this.history = [...this.history, { player: this.currentPlayer, word, reading }];
		const nextPlayer: Player = this.currentPlayer === 1 ? 2 : 1;
		this.challengeBf  = compile(last);
		this.expectedChar = last;
		this.hintVisible  = false;
		this.hintResult   = '';
		this.currentPlayer = nextPlayer;
	}

	endGame(losingPlayer: Player, reason: string) {
		this.gameOver    = true;
		this.loser       = losingPlayer;
		this.lossReason  = reason;
		this.inputWord   = '';
	}

	revealHint() {
		this.hintResult  = execute(this.challengeBf);
		this.hintVisible = true;
	}

	reset() {
		this.currentPlayer = 1;
		this.inputWord     = '';
		this.challengeBf   = '';
		this.expectedChar  = '';
		this.error         = '';
		this.history       = [];
		this.gameOver      = false;
		this.loser         = null;
		this.lossReason    = '';
		this.hintVisible   = false;
		this.hintResult    = '';
	}
}
