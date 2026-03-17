export type Player = 1 | 2;

export interface Turn {
	player: Player;
	word: string;
	reading: string;
}

export const PLAYER_COLORS: Record<Player, string> = {
	1: '#4ade80',
	2: '#f472b6',
};
