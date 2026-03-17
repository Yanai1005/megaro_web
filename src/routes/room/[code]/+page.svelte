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
		const playerId   = sessionStorage.getItem('playerId') ?? '';
		const playerSlot = sessionStorage.getItem('playerSlot');
		const slot = playerSlot === '1' ? 1 : playerSlot === '2' ? 2 : 'spectator' as const;

		// GET 現在の部屋状態（初期化・途中参加用）
		try {
			const res = await fetch(`${API_BASE}/api/room/${roomCode}`);
			if (res.ok) {
				const state = await res.json();
				game.hydrateFromRoomState(state);
			}
		} catch { /* オフライン時は無視 */ }

		try {
			await game.connect(roomCode, playerId, slot);
		} catch (e) {
			initError = 'SignalR 接続に失敗しました';
			console.error(e);
		}
	});

	onDestroy(() => game.disconnect());

	function copyCode() {
		navigator.clipboard.writeText(roomCode).catch(() => {});
	}

	const spectateUrl = $derived(
		typeof window !== 'undefined' ? `${window.location.origin}/spectate/${roomCode}` : ''
	);
</script>

<svelte:head>
	<title>Room {roomCode} — Brainfuck しりとり</title>
</svelte:head>

<div class="scanline min-h-screen text-green-100" style="background:#050a05;">
<div class="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">

	<header class="flex items-center justify-between">
		<h1 class="mono text-xl font-bold crt-glow" style="color:#4ade80;">Brainfuck しりとり</h1>
		<span class="mono text-green-700 text-xs">ROOM: {roomCode}</span>
	</header>

	{#if initError}
	<div class="border border-red-900 rounded-sm p-4 jp text-red-400 text-sm">{initError}</div>
	{/if}

	<!-- ── 待機中 ────────────────────────────────────────────── -->
	{#if game.roomStatus === 'waiting'}
	<div class="border border-green-900 rounded-sm p-6 flex flex-col gap-4" style="background:#0a150a;">
		<p class="mono text-green-600 text-xs">[ WAITING FOR OPPONENT ]</p>
		<p class="jp text-green-300">対戦相手を待っています…</p>

		<div>
			<p class="mono text-green-700 text-xs mb-1">ルームコードを共有する</p>
			<div class="flex gap-2 items-center">
				<span class="mono text-3xl font-bold tracking-widest" style="color:#4ade80;">{roomCode}</span>
				<button
					onclick={copyCode}
					class="mono text-xs px-3 py-1 rounded-sm border border-green-800 text-green-600 hover:text-green-400"
				>
					COPY
				</button>
			</div>
		</div>

		<div>
			<p class="mono text-green-700 text-xs mb-1">観戦リンク</p>
			<a href="/spectate/{roomCode}" class="mono text-green-800 text-xs hover:text-green-600 break-all">
				{spectateUrl}
			</a>
		</div>
	</div>

	<!-- ── ゲームオーバー ────────────────────────────────────── -->
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
		<div class="mb-6">
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
		<a href="/lobby" class="btn text-sm px-6 py-2 rounded-sm border border-green-700 text-green-300 bg-green-900 hover:bg-green-800">
			[ ロビーに戻る ]
		</a>
	</div>

	<!-- ── 対戦中 ─────────────────────────────────────────────── -->
	{:else}
	<!-- プレイヤーインジケーター -->
	<div class="flex gap-2">
		{#each [1, 2] as p}
			{@const active = game.currentPlayer === p}
			{@const pc = PLAYER_COLORS[p as 1 | 2]}
			{@const name = p === 1 ? game.player1Name : game.player2Name}
			{@const isMe = game.playerSlot === p}
			<div class="flex-1 rounded-sm py-2 px-3 mono text-sm transition-all duration-200"
				style="
					background:{active?(p===1?'#052e16':'#2d0a1e'):'#0a0a0a'};
					border:1px solid {active?pc:'#1a2a1a'};
					color:{active?pc:'#2d4a2d'};
				">
				{#if active}▶ {/if}{name || `PLAYER ${p}`}{#if isMe} <span class="text-xs opacity-60">(あなた)</span>{/if}
				{#if active}<span class="cursor"></span>{/if}
			</div>
		{/each}
	</div>

	<!-- Brainfuck チャレンジ表示 -->
	{#if game.challengeBf}
	<div class="fade-in border border-green-900 rounded-sm" style="background:#020d02;">
		<div class="border-b border-green-950 px-4 py-2">
			<span class="jp text-green-800 text-xs">{game.currentPlayer === 1 ? game.player1Name : game.player2Name}</span>
		</div>
		<div class="p-4">
			<div class="bf-block">{game.challengeBf}</div>
		</div>
	</div>
	{:else if !game.challengeBf && game.playerSlot === 1}
	<div class="border border-green-950 rounded-sm px-4 py-3 mono text-green-800 text-sm" style="background:#020d02;">
		► 先攻です。最初の単語をどうぞ。
	</div>
	{:else if !game.challengeBf && game.playerSlot === 2}
	<div class="border border-green-950 rounded-sm px-4 py-3 mono text-green-700 text-sm" style="background:#020d02;">
		► 相手の最初の単語を待機中…
	</div>
	{:else if !game.challengeBf && game.playerSlot === 'spectator'}
	<div class="border border-green-950 rounded-sm px-4 py-3 mono text-green-700 text-sm" style="background:#020d02;">
		► 先攻が最初の単語を入力待機中…
	</div>
	{/if}

	<!-- 入力フォーム -->
	{#if game.playerSlot !== 'spectator'}
	<div class="border border-green-900 rounded-sm px-5 py-5"
		style="--pc:{PLAYER_COLORS[game.playerSlot as 1|2] ?? '#4ade80'}; background:#0a150a;">
		<label for="word-input" class="jp font-black text-sm mb-3 block"
			style="color:{PLAYER_COLORS[game.playerSlot as 1|2] ?? '#4ade80'}">
			{game.isMyTurn ? 'あなたの番' : '相手の番を待っています…'}
			<span class="font-normal text-green-700">
				{#if game.expectedChar && game.isMyTurn}— Brainfuck を解読して入力{/if}
			</span>
		</label>

		{#if game.error}
		<p class="jp text-red-400 text-xs mb-3 fade-in">{game.error}</p>
		{/if}

		<div class="flex gap-3 items-end">
			<input id="word-input" class="input-field jp flex-1" type="text"
				bind:value={game.inputWord}
				onkeydown={(e) => e.key === 'Enter' && game.handleSubmit()}
				placeholder={game.submitting ? '送信中…' : game.isMyTurn ? (game.challengeBf ? 'コードを解読して…' : '最初の単語を…') : '相手の番…'}
				disabled={!game.isMyTurn || game.submitting}
				autocomplete="off" autocorrect="off" spellcheck={false}
			/>
			<button onclick={() => game.handleSubmit()}
				disabled={!game.isMyTurn || game.submitting}
				class="btn text-sm px-5 py-2 rounded-sm border font-bold"
				style="
					color:{PLAYER_COLORS[game.playerSlot as 1|2] ?? '#4ade80'};
					border-color:{PLAYER_COLORS[game.playerSlot as 1|2] ?? '#4ade80'}40;
					background:transparent;
				">
				{game.submitting ? '…' : '完了'}
			</button>
		</div>
		<p class="mono text-green-900 text-xs mt-2">↵ Enter でも送信</p>
	</div>
	{/if}

	<!-- ステータスバー -->
	<div class="flex justify-between mono text-green-900 text-xs px-1">
		<span>ROUND {game.round}</span>
		<span>WORDS {game.history.length}</span>
		<span>{game.expectedChar ? 'NEXT CHAR: [ENCRYPTED]' : 'FIRST MOVE'}</span>
		{#if game.playerSlot === 'spectator'}
		<span style="color:#f472b6;">SPECTATING</span>
		{/if}
	</div>
	{/if}

</div>
</div>
