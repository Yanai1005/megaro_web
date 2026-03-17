import { browser } from '$app/environment';

type Status = 'loading' | 'ready' | 'error';
let status: Status = 'loading';

interface WasmExports {
	memory: WebAssembly.Memory;
	_start: () => void;
	bf_compile: (charCount: number) => number;
	bf_execute: (charCount: number) => number;
}

let wasm: WasmExports | null = null;
let wasmInitPromise: Promise<void> | null = null;

const INPUT_BASE = 0;
const OUTPUT_BASE = 4096;
const MAX_INPUT_UTF16 = (OUTPUT_BASE - INPUT_BASE) / 2; 

export function initMoonBit(): Promise<void> {
	if (!browser) return Promise.resolve();
	if (wasm) return Promise.resolve();
	if (wasmInitPromise) return wasmInitPromise;

	wasmInitPromise = WebAssembly.instantiateStreaming(fetch('/moonbit/cmd_web.wasm'), {})
		.then(({ instance }) => {
			wasm = instance.exports as unknown as WasmExports;
			wasm._start();
			status = 'ready';
		})
		.catch((e) => {
			status = 'error';
			wasmInitPromise = null; 
			throw e;
		});

	return wasmInitPromise;
}

export function getStatus(): Status { return status; }

function writeUtf16(str: string): void {
	if (str.length > MAX_INPUT_UTF16) {
		throw new RangeError(`[bf] Input too long: ${str.length} code units exceed buffer capacity of ${MAX_INPUT_UTF16}`);
	}
	const view = new DataView(wasm!.memory.buffer);
	for (let i = 0; i < str.length; i++) {
		view.setUint16(INPUT_BASE + i * 2, str.charCodeAt(i), true);
	}
}

function readUtf16(charCount: number): string {
	const mem = new Uint8Array(wasm!.memory.buffer);
	let s = '';
	for (let i = 0; i < charCount; i++) {
		const lo = mem[OUTPUT_BASE + i * 2];
		const hi = mem[OUTPUT_BASE + i * 2 + 1];
		s += String.fromCharCode(lo | (hi << 8));
	}
	return s;
}

function readUtf8Bytes(charCount: number): string {
	const mem = new Uint8Array(wasm!.memory.buffer);
	const bytes = new Uint8Array(charCount);
	for (let i = 0; i < charCount; i++) {
		bytes[i] = mem[OUTPUT_BASE + i * 2];
	}
	return new TextDecoder('utf-8').decode(bytes);
}

export function compile(input: string): string {
	if (!wasm) throw new Error('WASM not loaded');
	writeUtf16(input);
	const len = wasm.bf_compile(input.length);
	return readUtf16(len);
}

export function execute(code: string): string {
	if (!wasm) throw new Error('WASM not loaded');
	writeUtf16(code);
	const len = wasm.bf_execute(code.length);

	return readUtf8Bytes(len);
}
