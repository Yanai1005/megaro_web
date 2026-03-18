<script lang="ts">
	import './page.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { initMoonBit, getStatus } from '$lib/bf.js';
	import { GameState } from '$lib/game.svelte.js';
	import { PLAYER_COLORS } from '$lib/types.js';
	import { warmupApi } from '$lib/kana.js';

	let moonbitStatus = $state<'loading' | 'ready' | 'error'>('loading');
	let apiStatus = $state<'warming' | 'ready' | 'error'>('warming');
	let mode = $state<'select' | 'local'>('select');
	const game = new GameState();

	onMount(async () => {
		warmupApi()
			.then(() => { apiStatus = 'ready'; })
			.catch(() => { apiStatus = 'error'; });
		await initMoonBit()
			.then(() => { moonbitStatus = getStatus(); })
			.catch((e) => { moonbitStatus = 'error'; console.error('initMoonBit failed:', e); });
	});

	function startLocal() {
		game.reset();
		mode = 'local';
	}
</script>

<svelte:head>
	<title>Brainfuck しりとり</title>
</svelte:head>

<div class="scanline min-h-screen text-green-100" style="background:#050a05;">
<div class="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">

	<header class="text-center">
		<h1 class="mono text-3xl font-bold crt-glow" style="color:#4ade80;">
			Brainfuck しりとり
		</h1>
	</header>

	<!-- モード選択 -->
	{#if mode === 'select'}
	<div class="flex flex-col gap-3">
		<button
			onclick={startLocal}
			class="btn border border-green-800 rounded-sm px-6 py-4 text-left"
			style="background:#0a150a; color:#4ade80;">
			<div class="text-sm font-bold">[ ローカル対戦 ]</div>
			<div class="jp text-green-700 text-xs mt-1">同じ画面で2人対戦</div>
		</button>
		<button
			onclick={() => goto('/lobby')}
			class="btn border border-pink-900 rounded-sm px-6 py-4 text-left"
			style="background:#1a0a12; color:#f472b6;">
			<div class="text-sm font-bold">[ オンライン対戦 ]</div>
			<div class="jp text-pink-900 text-xs mt-1">別々の端末でリアルタイム対戦</div>
		</button>
		{#if apiStatus !== 'ready'}
		<p class="mono text-xs text-center" style="color:{apiStatus === 'error' ? '#f87171' : '#6b6b00'};">
			{apiStatus === 'warming' ? '◌ 解析API起動中...' : '✗ 解析APIへの接続に失敗'}
		</p>
		{/if}
	</div>
	{:else if game.gameOver}
	<!-- ゲームオーバー画面 -->
	<div class="fade-in border border-green-900 rounded-sm p-6" style="background:#0a150a;">
		<p class="mono text-green-600 text-xs mb-4">[ GAME OVER ]</p>
		{#if game.loser}
			{@const winner = game.loser === 1 ? 2 : 1}
			<p class="jp text-2xl font-black mb-1" style="color:{PLAYER_COLORS[winner]}">
				Player {winner} の勝利！
			</p>
			<p class="jp text-red-400 text-sm mb-5">Player {game.loser} が{game.lossReason}</p>
		{/if}
		<div class="mb-6">
			<p class="mono text-green-700 text-xs mb-2">WORD LOG</p>
			<div class="history-chain jp text-base">
				{#each game.history as turn, i}
					{#if i > 0}<span class="mono text-green-900 text-xs">→</span>{/if}
					<span class="px-1.5 py-0.5 rounded-sm text-sm font-bold"
						style="background:{turn.player===1?'#052e16':'#2d0a1e'}; color:{PLAYER_COLORS[turn.player]};">
						P{turn.player}: {turn.word}
						{#if turn.reading !== turn.word}
							<span class="mono font-normal text-xs opacity-60">({turn.reading})</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
		<div class="flex gap-3">
			<button onclick={() => game.reset()}
				class="btn bg-green-900 hover:bg-green-800 text-green-300 border border-green-700 text-sm px-6 py-2 rounded-sm">
				[ RESTART ]
			</button>
			<button onclick={() => { game.reset(); mode = 'select'; }}
				class="btn text-green-800 border border-green-950 text-sm px-4 py-2 rounded-sm hover:text-green-600">
				← メニュー
			</button>
		</div>
	</div>

	{:else}

	<!-- プレイヤーインジケーター -->
	<div class="flex gap-2">
		{#each [1, 2] as p}
			{@const active = game.currentPlayer === p}
			{@const pc = PLAYER_COLORS[p as 1 | 2]}
			<div class="flex-1 rounded-sm py-2 px-3 mono text-sm transition-all duration-200"
				style="
					background:{active?(p===1?'#052e16':'#2d0a1e'):'#0a0a0a'};
					border:1px solid {active?pc:'#1a2a1a'};
					color:{active?pc:'#2d4a2d'};
				">
				{#if active}▶ {/if}PLAYER {p}
				{#if active}<span class="cursor"></span>{/if}
			</div>
		{/each}
	</div>

	<!-- Brainfuck チャレンジ表示 -->
	{#if game.challengeBf}
	<div class="fade-in border border-green-900 rounded-sm" style="background:#020d02;">
		<div class="border-b border-green-950 px-4 py-2">
			<span class="jp text-green-800 text-xs">Player {game.currentPlayer}</span>
		</div>
		<div class="p-4">
			<div class="bf-block">{game.challengeBf}</div>
		</div>
	</div>
	{:else}
	<div class="border border-green-950 rounded-sm px-4 py-3 mono text-green-800 text-sm" style="background:#020d02;">
		► 先攻です。最初の単語をどうぞ。
	</div>
	{/if}

	<!-- 入力フォーム -->
	<div class="border border-green-900 rounded-sm px-5 py-5"
		style="--pc:{game.playerColor}; background:#0a150a;">
		<label for="word-input" class="jp font-black text-sm mb-3 block pc-color">
			Player {game.currentPlayer}
			<span class="font-normal text-green-700">
				{#if game.expectedChar}の番 — Brainfuck を解読して入力{:else}の番 — 最初の単語を入力{/if}
			</span>
		</label>

		{#if game.error}
		<p class="jp text-red-400 text-xs mb-3 fade-in">{game.error}</p>
		{/if}

		<div class="flex gap-3 items-end">
			{#key game.currentPlayer}
			<input id="word-input" class="input-field jp flex-1" type="text"
				bind:value={game.inputWord}
				onkeydown={(e) => e.key === 'Enter' && game.handleSubmit()}
				placeholder={game.submitting ? '解析中…' : game.challengeBf ? 'コードを解読して…' : '単語を入力…'}
				disabled={game.submitting}
				autocomplete="off" autocorrect="off" spellcheck={false}
			/>
			{/key}
			<button onclick={() => game.handleSubmit()}
				disabled={game.submitting}
				class="btn text-sm px-5 py-2 rounded-sm border font-bold pc-btn">
				{game.submitting ? '…' : '完了'}
			</button>
		</div>
		<p class="mono text-green-900 text-xs mt-2">↵ Enter でも送信</p>
	</div>

	<!-- APIステータス -->
	{#if apiStatus !== 'ready'}
	<div class="fade-in mono text-xs px-3 py-2 border rounded-sm"
		style="background:#0a0a00; border-color:{apiStatus === 'error' ? '#7f1d1d' : '#3a2e00'}; color:{apiStatus === 'error' ? '#f87171' : '#ca8a04'};">
		{#if apiStatus === 'warming'}
		◌ 解析サーバー起動中… 初回のみ30秒ほどかかる場合があります
		{:else}
		✗ 解析サーバーへの接続に失敗しました
		{/if}
	</div>
	{/if}

	<!-- ステータスバー -->
	<div class="flex justify-between mono text-green-900 text-xs px-1">
		<span>ROUND {game.round}</span>
		<span>WORDS {game.history.length}</span>
		<span>{game.expectedChar ? 'NEXT CHAR: [ENCRYPTED]' : 'FIRST MOVE'}</span>
	</div>

	<!-- メニューへ戻る -->
	<button onclick={() => { game.reset(); mode = 'select'; }}
		class="btn text-green-800 border border-green-950 text-xs px-3 py-1.5 rounded-sm hover:text-green-600 self-start">
		← メニュー
	</button>

	{/if}

</div>
</div>
