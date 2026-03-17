<script lang="ts">
	import { onMount } from 'svelte';
	import { compile, execute, initMoonBit, getStatus } from '$lib/bf.js';
	import { initKuromoji, getHiraganaReading, isKuromojiReady, isValidSiritoriWord, isKnownWord } from '$lib/kana.js';

	let moonbitStatus = $state<'loading' | 'ready' | 'error'>('loading');
	let kuromojiStatus = $state<'loading' | 'ready' | 'fallback'>('loading');

	onMount(async () => {
		await Promise.all([
			initMoonBit()
				.then(() => { moonbitStatus = getStatus(); })
				.catch((e) => { moonbitStatus = 'error'; console.error('initMoonBit failed:', e); }),
			initKuromoji()
				.then(() => { kuromojiStatus = isKuromojiReady() ? 'ready' : 'fallback'; })
				.catch((e) => { kuromojiStatus = 'fallback'; console.error('initKuromoji failed:', e); })
		]);
	});

	type Player = 1 | 2;

	interface Turn {
		player: Player;
		word: string;
		reading: string; // ひらがな読み
	}

	let currentPlayer = $state<Player>(1);
	let inputWord = $state('');
	let challengeBf = $state('');
	let expectedChar = $state('');
	let error = $state('');
	let history = $state<Turn[]>([]);
	let gameOver = $state(false);
	let loser = $state<Player | null>(null);
	let lossReason = $state('');
	let hintVisible = $state(false);
	let hintResult = $state('');

	let round = $derived(history.length + 1);

	const wordBody = (w: string) => w.match(/^([^(（]+)/)?.[1]?.trimEnd() ?? w;
	let usedWords = $derived(new Set(history.map((h) => wordBody(h.word))));


	const chars = (s: string) => [...s];
	const firstChar = (s: string) => chars(s)[0] ?? '';
	const lastChar = (s: string) => { const c = chars(s); return c[c.length - 1] ?? ''; };
	const isHiragana = (c: string) => { const cp = c.codePointAt(0) ?? 0; return cp >= 0x3041 && cp <= 0x309e; };

	/**
	 * 入力から読みを取得する。
	 * - 「東京(とうきょう)」形式なら括弧内のひらがなを優先
	 * - それ以外は kuromoji で変換
	 */
	function resolveReading(word: string): string {
		const manual = word.match(/[(（]([ぁ-ん]+)[)）]$/);
		if (manual) return manual[1];
		// word から括弧注記を除いた本体で読みを取得
		const body = word.match(/^([^(（]+)/)?.[1]?.trimEnd() ?? word;
		return getHiraganaReading(body);
	}

	function redactedReading(reading: string) {
		const c = chars(reading);
		return { prefix: c.slice(0, -1).join(''), last: c[c.length - 1] ?? '' };
	}


	function handleSubmit() {
		const word = inputWord.trim();
		inputWord = '';
		error = '';
		if (!word) { error = '単語を入力してください'; return; }

		const reading = resolveReading(word);

		if (kuromojiReady && !isValidSiritoriWord(wordBody(word))) {
			error = '文章は使えません。単語を入力してください';
			return;
		}
		if (kuromojiReady && !isKnownWord(word)) {
			error = '辞書に見つかりません。実在する単語か「単語(よみ)」の形で入力してください';
			return;
		}

		if (expectedChar && firstChar(reading) !== expectedChar) {
			error = `Brainfuck を解読すると… 「${expectedChar}」から始まる単語を入力してください`;
			return;
		}
		if (usedWords.has(wordBody(word))) {
			history = [...history, { player: currentPlayer, word, reading }];
			endGame(currentPlayer, `「${wordBody(word)}」はすでに使われた単語です`);
			return;
		}
		const last = lastChar(reading);
		if (!isHiragana(last)) {
			error = kuromojiReady
				? '読みを取得できませんでした。「東京(とうきょう)」のように括弧で読みを付けてください'
				: '辞書読み込み中です。しばらくお待ちください…';
			return;
		}
		if (last === 'ん') {
			history = [...history, { player: currentPlayer, word, reading }];
			endGame(currentPlayer, `「${reading}」で終わる単語を言いました`);
			return;
		}

		history = [...history, { player: currentPlayer, word, reading }];
		const nextPlayer: Player = currentPlayer === 1 ? 2 : 1;
		challengeBf = compile(last);
		expectedChar = last;
		hintVisible = false;
		hintResult = '';
		currentPlayer = nextPlayer;
	}

	const kuromojiReady = $derived(kuromojiStatus === 'ready');

	function endGame(losingPlayer: Player, reason: string) {
		gameOver = true;
		loser = losingPlayer;
		lossReason = reason;
		inputWord = '';
	}

	function revealHint() {
		hintResult = execute(challengeBf);
		hintVisible = true;
	}

	function resetGame() {
		currentPlayer = 1;
		inputWord = '';
		challengeBf = '';
		expectedChar = '';
		error = '';
		history = [];
		gameOver = false;
		loser = null;
		lossReason = '';
		hintVisible = false;
		hintResult = '';
	}

	const PC: Record<Player, string> = { 1: '#4ade80', 2: '#f472b6' };
</script>

<svelte:head>
	<title>Brainfuck しりとり</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Zen+Kaku+Gothic+New:wght@400;700;900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<style>
	:global(body) { background: #050a05; margin: 0; }
	.mono { font-family: 'Share Tech Mono', monospace; }
	.jp   { font-family: 'Zen Kaku Gothic New', sans-serif; }

	.scanline::after {
		content: '';
		position: fixed;
		inset: 0;
		background: repeating-linear-gradient(
			0deg, transparent, transparent 2px,
			rgba(0,0,0,.07) 2px, rgba(0,0,0,.07) 4px
		);
		pointer-events: none;
		z-index: 100;
	}
	.crt-glow { text-shadow: 0 0 8px currentColor, 0 0 20px currentColor; }

	.bf-block {
		overflow-wrap: break-word; word-break: break-all;
		font-family: 'Share Tech Mono', monospace;
		font-size: .8rem; line-height: 1.7;
		color: #86efac; letter-spacing: .05em;
	}
	.input-field {
		background: transparent; border: none;
		border-bottom: 2px solid #16a34a; border-radius: 0; outline: none;
		font-family: 'Zen Kaku Gothic New', sans-serif;
		font-size: 1.4rem; font-weight: 700; color: #f0fdf4;
		width: 100%; padding: .5rem .25rem; transition: border-color .2s;
	}
	.input-field::placeholder { color: #166534; font-weight: 400; }
	.input-field:focus { border-color: #4ade80; }

	.btn { font-family: 'Share Tech Mono', monospace; letter-spacing: .1em; cursor: pointer; transition: background .15s, transform .1s; }
	.btn:active { transform: scale(.97); }

	.history-chain { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem; }
	.redacted {
		display: inline-block; background: #166534; color: #166534;
		border-radius: 2px; padding: 0 3px; user-select: none;
		min-width: 1em; text-align: center;
	}

	@keyframes blink { 50% { opacity: 0; } }
	.cursor::after { content: '▌'; animation: blink 1s step-end infinite; color: #4ade80; margin-left: 2px; }

	@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
	.fade-in { animation: fadeIn .3s ease forwards; }

	/* ステータスバッジ */
	.badge { display: inline-block; font-family: 'Share Tech Mono', monospace; font-size: .65rem; padding: 1px 6px; border-radius: 2px; }
</style>

<div class="scanline min-h-screen text-green-100" style="background:#050a05;">
<div class="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">

	<header class="text-center">
		<h1 class="mono text-3xl font-bold crt-glow" style="color:#4ade80;">
			Brainfuck しりとり
		</h1>
	</header>

	{#if gameOver}
	<div class="fade-in border border-green-900 rounded-sm p-6" style="background:#0a150a;">
		<p class="mono text-green-600 text-xs mb-4">[ GAME OVER ]</p>
		{#if loser}
			<p class="jp text-2xl font-black mb-1" style="color:{PC[loser === 1 ? 2 : 1]}">
				Player {loser === 1 ? 2 : 1} の勝利！
			</p>
			<p class="jp text-red-400 text-sm mb-5">Player {loser} が{lossReason}</p>
		{/if}
		<div class="mb-6">
			<p class="mono text-green-700 text-xs mb-2">WORD LOG</p>
			<div class="history-chain jp text-base">
				{#each history as turn, i}
					{#if i > 0}<span class="mono text-green-900 text-xs">→</span>{/if}
					<span class="px-1.5 py-0.5 rounded-sm text-sm font-bold"
						style="background:{turn.player===1?'#052e16':'#2d0a1e'}; color:{PC[turn.player]};">
						P{turn.player}: {turn.word}
						{#if turn.reading !== turn.word}
							<span class="mono font-normal text-xs opacity-60">({turn.reading})</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
		<button onclick={resetGame}
			class="btn bg-green-900 hover:bg-green-800 text-green-300 border border-green-700 text-sm px-6 py-2 rounded-sm">
			[ RESTART ]
		</button>
	</div>

	{:else}

	<div class="flex gap-2">
		{#each [1, 2] as p}
			<div class="flex-1 rounded-sm py-2 px-3 mono text-sm transition-all duration-200"
				style="
					background:{currentPlayer===p?(p===1?'#052e16':'#2d0a1e'):'#0a0a0a'};
					border:1px solid {currentPlayer===p?PC[p as Player]:'#1a2a1a'};
					color:{currentPlayer===p?PC[p as Player]:'#2d4a2d'};
				">
				{#if currentPlayer===p}▶ {/if}PLAYER {p}
				{#if currentPlayer===p}<span class="cursor"></span>{/if}
			</div>
		{/each}
	</div>

	{#if challengeBf}
	<div class="fade-in border border-green-900 rounded-sm" style="background:#020d02;">
		<div class="border-b border-green-950 px-4 py-2 flex items-center justify-between">
			<span class="jp text-green-800 text-xs">Player {currentPlayer} </span>
		</div>
		<div class="p-4">
			<div class="bf-block">{challengeBf}</div>
		</div>
	</div>
	{:else}
	<div class="border border-green-950 rounded-sm px-4 py-3 mono text-green-800 text-sm" style="background:#020d02;">
		► 先攻です。最初の単語をどうぞ。
	</div>
	{/if}


	<div class="border border-green-900 rounded-sm px-5 py-5" style="background:#0a150a;">
		<label class="jp font-black text-sm mb-3 block" style="color:{PC[currentPlayer]};">
			Player {currentPlayer}
			<span class="font-normal text-green-700">
				{#if expectedChar}の番 — Brainfuck を解読して入力{:else}の番 — 最初の単語を入力{/if}
			</span>
		</label>

		<div class="flex gap-3 items-end">
			{#key currentPlayer}
			<input class="input-field jp flex-1" type="text"
				bind:value={inputWord}
				onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
				placeholder={challengeBf ? 'コードを解読して…' : '単語を入力…'}
				autocomplete="off" autocorrect="off" spellcheck={false}
			/>
			{/key}
			<button onclick={handleSubmit}
				class="btn text-sm px-5 py-2 rounded-sm border font-bold"
				style="background:{PC[currentPlayer]}22; border-color:{PC[currentPlayer]}66; color:{PC[currentPlayer]};">
				完了
			</button>
		</div>
		<p class="mono text-green-900 text-xs mt-2">↵ Enter でも送信</p>
	</div>

	<div class="flex justify-between mono text-green-900 text-xs px-1">
		<span>ROUND {round}</span>
		<span>WORDS {history.length}</span>
		<span>{expectedChar ? 'NEXT CHAR: [ENCRYPTED]' : 'FIRST MOVE'}</span>
	</div>

	{/if}

</div>
</div>