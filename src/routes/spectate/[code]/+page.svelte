<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { OnlineGameState } from '$lib/online-game.svelte.js';
	import { PLAYER_COLORS } from '$lib/types.js';

	const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
	const roomCode = $derived(($page.params.code ?? '').toUpperCase());

	const game = new OnlineGameState();
	let initError = $state('');

	onMount(async () => {
		// 現在の部屋状態を取得して hydrate
		try {
			const res = await fetch(`${API_BASE}/api/room/${roomCode}`);
			if (res.ok) {
				const state = await res.json();
				game.hydrateFromRoomState(state);
			}
		} catch { /* ignore */ }

		try {
			await game.connect(roomCode, '', 'spectator');
		} catch (e) {
			initError = 'SignalR 接続に失敗しました';
			console.error(e);
		}
	});

	onDestroy(() => game.disconnect());
</script>

<svelte:head>
	<title>観戦 {roomCode} — Brainfuck しりとり</title>
</svelte:head>

<div class="scanline min-h-screen text-green-100" style="background:#050a05;">
<div class="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">

	<header class="flex items-center justify-between">
		<h1 class="mono text-xl font-bold crt-glow" style="color:#4ade80;">Brainfuck しりとり</h1>
		<span class="mono text-xs px-2 py-1 rounded-sm border" style="color:#f472b6;border-color:#831843;">SPECTATING</span>
	</header>

	{#if initError}
	<div class="border border-red-900 rounded-sm p-4 jp text-red-400 text-sm">{initError}</div>
	{/if}

	{#if game.roomStatus === 'waiting'}
	<div class="border border-green-900 rounded-sm p-6" style="background:#0a150a;">
		<p class="jp text-green-400">ゲームの開始を待っています…</p>
	</div>

	{:else if game.gameOver}
	<div class="fade-in border border-green-900 rounded-sm p-6" style="background:#0a150a;">
		<p class="mono text-green-600 text-xs mb-4">[ GAME OVER ]</p>
		{#if game.loser}
			{@const winner = game.loser === 1 ? 2 : 1}
			{@const winnerName = winner === 1 ? game.player1Name : game.player2Name}
			{@const loserName = game.loser === 1 ? game.player1Name : game.player2Name}
			<p class="jp text-2xl font-black mb-1" style="color:{PLAYER_COLORS[winner]}">
				{winnerName} の勝利！
			</p>
			<p class="jp text-red-400 text-sm mb-5">{loserName} が{game.lossReason}</p>
		{/if}
		<div class="mb-4">
			<p class="mono text-green-700 text-xs mb-2">WORD LOG</p>
			<div class="history-chain jp text-base">
				{#each game.history as turn, i}
					{#if i > 0}<span class="mono text-green-900 text-xs">→</span>{/if}
					<span class="px-1.5 py-0.5 rounded-sm text-sm font-bold"
						style="background:{turn.player===1?'#052e16':'#2d0a1e'}; color:{PLAYER_COLORS[turn.player]};">
						{turn.player===1?game.player1Name:game.player2Name}: {turn.word}
						{#if turn.reading !== turn.word}
							<span class="mono font-normal text-xs opacity-60">({turn.reading})</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
	</div>

	{:else}
	<!-- プレイヤーインジケーター -->
	<div class="flex gap-2">
		{#each [1, 2] as p}
			{@const active = game.currentPlayer === p}
			{@const pc = PLAYER_COLORS[p as 1 | 2]}
			{@const name = p === 1 ? game.player1Name : game.player2Name}
			<div class="flex-1 rounded-sm py-2 px-3 mono text-sm transition-all duration-200"
				style="
					background:{active?(p===1?'#052e16':'#2d0a1e'):'#0a0a0a'};
					border:1px solid {active?pc:'#1a2a1a'};
					color:{active?pc:'#2d4a2d'};
				">
				{#if active}▶ {/if}{name || `PLAYER ${p}`}
				{#if active}<span class="cursor"></span>{/if}
			</div>
		{/each}
	</div>

	<!-- Brainfuck チャレンジ表示 -->
	{#if game.challengeBf}
	<div class="fade-in border border-green-900 rounded-sm" style="background:#020d02;">
		<div class="border-b border-green-950 px-4 py-2">
			<span class="jp text-green-800 text-xs">{game.currentPlayer === 1 ? game.player1Name : game.player2Name} の番</span>
		</div>
		<div class="p-4">
			<div class="bf-block">{game.challengeBf}</div>
		</div>
	</div>
	{:else}
	<div class="border border-green-950 rounded-sm px-4 py-3 mono text-green-800 text-sm" style="background:#020d02;">
		► 先攻のプレイヤーが最初の単語を考えています…
	</div>
	{/if}

	<!-- 履歴 -->
	{#if game.history.length > 0}
	<div class="border border-green-900 rounded-sm p-4" style="background:#0a150a;">
		<p class="mono text-green-700 text-xs mb-2">WORD LOG</p>
		<div class="history-chain jp text-sm">
			{#each game.history as turn, i}
				{#if i > 0}<span class="mono text-green-900 text-xs">→</span>{/if}
				<span class="px-1.5 py-0.5 rounded-sm font-bold"
					style="background:{turn.player===1?'#052e16':'#2d0a1e'}; color:{PLAYER_COLORS[turn.player]};">
					{turn.player===1?game.player1Name:game.player2Name}: {turn.word}
					{#if turn.reading !== turn.word}
						<span class="mono font-normal text-xs opacity-60">({turn.reading})</span>
					{/if}
				</span>
			{/each}
		</div>
	</div>
	{/if}

	<!-- ステータスバー -->
	<div class="flex justify-between mono text-green-900 text-xs px-1">
		<span>ROUND {game.round}</span>
		<span>WORDS {game.history.length}</span>
		<span>{game.expectedChar ? 'NEXT CHAR: [ENCRYPTED]' : 'FIRST MOVE'}</span>
		<span style="color:#f472b6;">SPECTATING</span>
	</div>
	{/if}

</div>
</div>
