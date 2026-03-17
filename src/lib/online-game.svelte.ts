import * as signalR from '@microsoft/signalr';
import type { Player, Turn } from '$lib/types.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── 型定義 ────────────────────────────────────────────────────────────────

export type OnlinePlayerSlot = 1 | 2 | 'spectator';

interface RoomState {
	status: 'waiting' | 'playing' | 'finished';
	player1Name: string;
	player2Name: string;
	currentPlayer: Player;
	expectedChar: string;
	challengeBf: string;
	history: Turn[];
	usedWords: string[];
	losingPlayer?: Player | null;
	lossReason?: string;
}

// ── OnlineGameState ────────────────────────────────────────────────────────

export class OnlineGameState {
	// Connection state
	playerSlot  = $state<OnlinePlayerSlot | null>(null);
	playerId    = $state('');
	roomCode    = $state('');
	connected   = $state(false);

	// Game state (mirrors GameState)
	currentPlayer = $state<Player>(1);
	inputWord     = $state('');
	challengeBf   = $state('');
	expectedChar  = $state('');
	error         = $state('');
	history       = $state<Turn[]>([]);
	gameOver      = $state(false);
	loser         = $state<Player | null>(null);
	lossReason    = $state('');
	submitting    = $state(false);

	// Room state
	player1Name   = $state('');
	player2Name   = $state('');
	roomStatus    = $state<'waiting' | 'playing' | 'finished'>('waiting');

	round         = $derived(this.history.length + 1);

	#connection: signalR.HubConnection | null = null;

	get isMyTurn(): boolean {
		return this.playerSlot !== 'spectator' && this.currentPlayer === this.playerSlot;
	}

	// ── 接続 ──────────────────────────────────────────────────────────────

	async connect(roomCode: string, playerId: string, playerSlot: OnlinePlayerSlot) {
		this.roomCode   = roomCode;
		this.playerId   = playerId;
		this.playerSlot = playerSlot;

		const connection = new signalR.HubConnectionBuilder()
			.withUrl(`${API_BASE}/api`, {
				skipNegotiation: false,
			})
			.withAutomaticReconnect()
			.build();

		connection.on('gameStarted', (payload: { player1Name: string; player2Name: string; currentPlayer: Player }) => {
			this.player1Name   = payload.player1Name;
			this.player2Name   = payload.player2Name;
			this.currentPlayer = payload.currentPlayer;
			this.roomStatus    = 'playing';
		});

		connection.on('turnPlayed', (payload: {
			turn: Turn;
			nextPlayer: Player;
			expectedChar: string;
			challengeBf: string;
			round: number;
		}) => {
			this.history       = [...this.history, payload.turn];
			this.currentPlayer = payload.nextPlayer;
			this.expectedChar  = payload.expectedChar;
			this.challengeBf   = payload.challengeBf;
			this.error         = '';
		});

		connection.on('turnRejected', (payload: { error: string }) => {
			this.error      = payload.error;
			this.submitting = false;
		});

		connection.on('gameOver', (payload: {
			losingPlayer: Player;
			lossReason: string;
			finalHistory: Turn[];
		}) => {
			this.history     = payload.finalHistory;
			this.gameOver    = true;
			this.loser       = payload.losingPlayer;
			this.lossReason  = payload.lossReason;
			this.roomStatus  = 'finished';
			this.submitting  = false;
		});

		await connection.start();
		this.#connection = connection;
		this.connected   = true;

		// グループに参加
		await fetch(`${API_BASE}/api/room/join-group`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ connectionId: connection.connectionId, roomCode }),
		});
	}

	disconnect() {
		this.#connection?.stop();
		this.#connection = null;
		this.connected   = false;
	}

	// ── 単語提出 ──────────────────────────────────────────────────────────

	async handleSubmit() {
		if (this.submitting || !this.isMyTurn) return;
		const word = this.inputWord.trim();
		this.inputWord = '';
		this.error     = '';
		if (!word) { this.error = '単語を入力してください'; return; }

		this.submitting = true;
		try {
			const res = await fetch(`${API_BASE}/api/game/submit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roomCode: this.roomCode, playerId: this.playerId, word }),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({ error: '送信に失敗しました' }));
				this.error = data.error ?? '送信に失敗しました';
				this.submitting = false;
			}
			// 成功時は SignalR broadcast で状態更新されるので submitting は turnPlayed/gameOver で解除
			// ただし turnPlayed で submitting をリセットするため、ここでも reset しておく
			this.submitting = false;
		} catch {
			this.error      = 'ネットワークエラーが発生しました';
			this.submitting = false;
		}
	}

	// ── 途中参加時の状態復元 ──────────────────────────────────────────────

	hydrateFromRoomState(state: RoomState) {
		this.player1Name   = state.player1Name;
		this.player2Name   = state.player2Name;
		this.roomStatus    = state.status;
		this.currentPlayer = state.currentPlayer;
		this.expectedChar  = state.expectedChar;
		this.challengeBf   = state.challengeBf;
		this.history       = state.history;
		if (state.status === 'finished' && state.losingPlayer) {
			this.gameOver   = true;
			this.loser      = state.losingPlayer;
			this.lossReason = state.lossReason ?? '';
		}
	}
}
