<script lang="ts">
	import { goto } from '$app/navigation';

	const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

	let tab = $state<'create' | 'join'>('create');
	let playerName = $state('');
	let roomCodeInput = $state('');
	let error = $state('');
	let loading = $state(false);

	async function createRoom() {
		if (!playerName.trim()) { error = 'プレイヤー名を入力してください'; return; }
		error = '';
		loading = true;
		try {
			const res = await fetch(`${API_BASE}/api/room/create`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerName: playerName.trim() }),
			});
			if (!res.ok) { error = '部屋の作成に失敗しました'; return; }
			const { roomCode, playerId, playerSlot } = await res.json();
			sessionStorage.setItem('playerId', playerId);
			sessionStorage.setItem('playerSlot', String(playerSlot));
			sessionStorage.setItem('playerName', playerName.trim());
			await goto(`/room/${roomCode}`);
		} catch {
			error = 'ネットワークエラーが発生しました';
		} finally {
			loading = false;
		}
	}

	async function joinRoom() {
		if (!playerName.trim()) { error = 'プレイヤー名を入力してください'; return; }
		if (!roomCodeInput.trim()) { error = 'ルームコードを入力してください'; return; }
		error = '';
		loading = true;
		try {
			const res = await fetch(`${API_BASE}/api/room/join`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roomCode: roomCodeInput.trim().toUpperCase(), playerName: playerName.trim() }),
			});
			if (res.status === 404) { error = '部屋が見つかりません'; return; }
			if (res.status === 410) { error = 'このゲームはすでに終了しています'; return; }
			if (!res.ok) { error = '参加に失敗しました'; return; }
			const { playerId, playerSlot, roomCode } = await res.json();
			sessionStorage.setItem('playerId', playerId ?? '');
			sessionStorage.setItem('playerSlot', String(playerSlot));
			sessionStorage.setItem('playerName', playerName.trim());
			await goto(`/room/${roomCode}`);
		} catch {
			error = 'ネットワークエラーが発生しました';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>ロビー — Brainfuck しりとり</title>
</svelte:head>

<div class="scanline min-h-screen text-green-100" style="background:#050a05;">
<div class="max-w-md mx-auto px-4 py-8 flex flex-col gap-6">

	<header class="text-center">
		<h1 class="mono text-3xl font-bold crt-glow" style="color:#4ade80;">
			Brainfuck しりとり
		</h1>
		<p class="mono text-green-700 text-xs mt-1">ONLINE LOBBY</p>
	</header>

	<div class="border border-green-900 rounded-sm" style="background:#0a150a;">
		<!-- Tab bar -->
		<div class="flex border-b border-green-900">
			{#each [['create', '部屋を作る'], ['join', '部屋に入る']] as [id, label]}
				<button
					onclick={() => { tab = id as 'create' | 'join'; error = ''; }}
					class="flex-1 py-2 mono text-sm transition-colors"
					style="
						color:{tab === id ? '#4ade80' : '#2d4a2d'};
						background:{tab === id ? '#052e16' : 'transparent'};
						border-bottom:{tab === id ? '2px solid #4ade80' : '2px solid transparent'};
					"
				>
					{label}
				</button>
			{/each}
		</div>

		<div class="p-5 flex flex-col gap-4">
			<div>
				<label for="player-name" class="jp text-green-600 text-xs block mb-1">プレイヤー名</label>
				<input
					id="player-name"
					type="text"
					bind:value={playerName}
					placeholder="名前を入力…"
					maxlength={20}
					class="input-field jp w-full"
					autocomplete="off"
				/>
			</div>

			{#if tab === 'join'}
			<div>
				<label for="room-code" class="jp text-green-600 text-xs block mb-1">ルームコード</label>
				<input
					id="room-code"
					type="text"
					bind:value={roomCodeInput}
					placeholder="6文字のコード"
					maxlength={6}
					class="input-field mono w-full uppercase"
					autocomplete="off"
					oninput={(e) => { roomCodeInput = e.currentTarget.value.toUpperCase(); }}
				/>
			</div>
			{/if}

			{#if error}
			<p class="jp text-red-400 text-xs fade-in">{error}</p>
			{/if}

			<button
				onclick={tab === 'create' ? createRoom : joinRoom}
				disabled={loading}
				class="btn text-sm px-5 py-2 rounded-sm border font-bold"
				style="
					color:#4ade80;
					border-color:#166534;
					background:{loading ? '#052e16' : '#0a1f0a'};
				"
			>
				{#if loading}…{:else if tab === 'create'}[ 部屋を作る ]{:else}[ 入室する ]{/if}
			</button>
		</div>
	</div>

	<a href="/" class="mono text-green-800 text-xs text-center hover:text-green-600">
		← ローカル対戦に戻る
	</a>

</div>
</div>
