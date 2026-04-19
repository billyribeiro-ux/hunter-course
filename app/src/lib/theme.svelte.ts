import { browser } from '$app/environment';

/**
 * Theme store using Svelte 5 runes. Exposes a singleton `theme` object with:
 *
 *   - `theme.value`   — the currently-applied theme ("light" | "dark")
 *   - `theme.toggle()`
 *   - `theme.set(next)`
 *
 * The initial value is set synchronously in `app.html` to prevent a flash.
 * Here we just mirror it into a rune so components can re-render when it
 * changes, and we persist to localStorage on every update.
 */
export type Theme = 'light' | 'dark';

const KEY = 'contactly:theme';

function readInitial(): Theme {
	if (!browser) return 'dark';
	const attr = document.documentElement.getAttribute('data-theme');
	return attr === 'light' ? 'light' : 'dark';
}

function createTheme() {
	let value = $state<Theme>(readInitial());

	function set(next: Theme) {
		value = next;
		if (browser) {
			document.documentElement.setAttribute('data-theme', next);
			try {
				localStorage.setItem(KEY, next);
			} catch {
				/* Storage is full or blocked — non-fatal. */
			}
		}
	}

	function toggle() {
		set(value === 'dark' ? 'light' : 'dark');
	}

	return {
		get value() {
			return value;
		},
		set,
		toggle
	};
}

export const theme = createTheme();
