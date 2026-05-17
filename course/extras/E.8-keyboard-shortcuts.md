# E.8 — Keyboard Shortcuts

> `cmd+k` opens a command palette. `n` creates a new contact. `/` focuses search. Ten shortcuts that turn a mouse-driven app into a professional tool.

## Why this matters

Power users don't want to click. They want to type. Every SaaS tool they respect — Linear, Notion, Superhuman — rewards keyboard-first navigation. Contactly without shortcuts feels like a toy next to those; Contactly with shortcuts feels like a peer.

This lesson adds a keyboard system: a global registry, a command palette (`cmd+k`), per-route shortcuts, and a cheatsheet (`?`) that shows what's available in context.

## The Principal Engineer lens

**Keyboard shortcuts are an API.** Users memorise them; changes break muscle memory. Pick conventions deliberately, document them once, and don't rearrange. `cmd+k` is the command palette in every app you use — don't make it "search" in yours.

Corollary: **shortcuts must respect focus context.** Pressing `n` should create a new contact — unless the user is typing in a search box, in which case it should type `n`. The first shortcut bug every junior engineer ships is "my typing triggers actions." Guard against it at the system level.

## Step 1 — The registry

`src/lib/stores/shortcuts.svelte.ts`:

```ts
import { browser } from '$app/environment';

export interface Shortcut {
	/** Keys, separated by + (e.g. "cmd+k", "shift+/", "n") */
	keys: string;
	label: string;
	scope: 'global' | string; // route path for scoped shortcuts
	action: () => void;
}

function createShortcutStore() {
	let shortcuts = $state<Shortcut[]>([]);

	function register(s: Shortcut): () => void {
		shortcuts = [...shortcuts, s];
		return () => {
			shortcuts = shortcuts.filter((x) => x !== s);
		};
	}

	function matches(e: KeyboardEvent, keys: string): boolean {
		const parts = keys.toLowerCase().split('+');
		const key = parts[parts.length - 1];
		const mods = parts.slice(0, -1);
		if (mods.includes('cmd') !== (e.metaKey || e.ctrlKey)) return false;
		if (mods.includes('shift') !== e.shiftKey) return false;
		if (mods.includes('alt') !== e.altKey) return false;
		return e.key.toLowerCase() === key;
	}

	function isTyping(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
		if (target.isContentEditable) return true;
		return false;
	}

	if (browser) {
		window.addEventListener('keydown', (e) => {
			const typing = isTyping(e.target);
			const currentPath = window.location.pathname;

			for (const s of shortcuts) {
				const scoped = s.scope === 'global' || currentPath.startsWith(s.scope);
				if (!scoped) continue;

				// Modifier-bearing shortcuts override typing check (cmd+k always works)
				const hasModifier = /cmd|alt|shift/.test(s.keys);
				if (typing && !hasModifier) continue;

				if (matches(e, s.keys)) {
					e.preventDefault();
					s.action();
					return;
				}
			}
		});
	}

	return {
		get all() {
			return shortcuts;
		},
		register
	};
}

export const shortcuts = createShortcutStore();
```

A single global listener dispatches to registered shortcuts. Each consumer component calls `shortcuts.register(...)` and holds the returned unregister function for cleanup.

## Step 2 — The `useShortcut` helper for components

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { shortcuts, type Shortcut } from '$lib/stores/shortcuts.svelte.ts';

	let { children }: { children: Snippet } = $props();

	function useShortcut(s: Shortcut) {
		const unregister = shortcuts.register(s);
		onDestroy(unregister);
	}
</script>
```

Inline component usage:

```svelte
<script lang="ts">
	import { shortcuts } from '$lib/stores/shortcuts.svelte.ts';
	import { onDestroy } from 'svelte';

	let showNewForm = $state(false);

	const unreg = shortcuts.register({
		keys: 'n',
		label: 'New contact',
		scope: '/app',
		action: () => (showNewForm = true)
	});

	onDestroy(unreg);
</script>
```

Components own their own shortcut registrations. When they unmount, their shortcuts unregister cleanly.

## Step 3 — The command palette

`src/lib/components/CommandPalette.svelte`:

```svelte
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { shortcuts } from '$lib/stores/shortcuts.svelte.ts';
	import { goto } from '$app/navigation';

	let open = $state(false);
	let query = $state('');

	const unreg = shortcuts.register({
		keys: 'cmd+k',
		label: 'Open command palette',
		scope: 'global',
		action: () => {
			open = true;
			query = '';
		}
	});
	onDestroy(unreg);

	interface Command {
		id: string;
		label: string;
		action: () => void;
	}

	const commands: Command[] = [
		{ id: 'contacts', label: 'Go to contacts', action: () => goto('/app') },
		{ id: 'account', label: 'Go to account', action: () => goto('/app/account') },
		{ id: 'pricing', label: 'Go to pricing', action: () => goto('/pricing') },
		{ id: 'logout', label: 'Sign out', action: () => goto('/logout') }
	];

	let filtered = $derived(
		query.trim()
			? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
			: commands
	);
	let highlighted = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (open && inputEl) inputEl.focus();
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
		else if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = (highlighted + 1) % filtered.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = (highlighted - 1 + filtered.length) % filtered.length;
		} else if (e.key === 'Enter') {
			const cmd = filtered[highlighted];
			if (cmd) {
				cmd.action();
				open = false;
			}
		}
	}
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') open = false; }} />

{#if open}
	<div class="modal-root">
		<button
			type="button"
			class="overlay"
			aria-label="Close command palette"
			onclick={() => (open = false)}
		></button>
		<div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
			<input
				type="text"
				placeholder="Type a command…"
				bind:this={inputEl}
				bind:value={query}
				oninput={() => (highlighted = 0)}
				onkeydown={onKey}
			/>
			<ul>
				{#each filtered as cmd, i (cmd.id)}
					<li>
						<button
							type="button"
							class:highlighted={i === highlighted}
							onclick={() => {
								cmd.action();
								open = false;
							}}
						>
							{cmd.label}
						</button>
					</li>
				{/each}
				{#if filtered.length === 0}
					<li class="empty">No commands match.</li>
				{/if}
			</ul>
		</div>
	</div>
{/if}

<style>
	.modal-root {
		position: fixed;
		inset: 0;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 10vh;
		z-index: 10000;
	}
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		border: 0;
		padding: 0;
		cursor: default;
	}
	.palette {
		position: relative;
		background: white;
		border-radius: 0.75rem;
		width: min(36rem, 90vw);
		padding: 0.5rem;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
	}
	input {
		width: 100%;
		padding: 0.85rem 1rem;
		border: 0;
		font-size: 1rem;
		outline: none;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		max-height: 20rem;
		overflow-y: auto;
	}
	li button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.65rem 1rem;
		background: transparent;
		border: 0;
		font: inherit;
		cursor: pointer;
	}
	li button.highlighted {
		background: #eef2ff;
	}
	li.empty {
		padding: 0.65rem 1rem;
		color: #9ca3af;
	}
</style>
```

Mount in the root layout — available everywhere.

## Step 4 — The cheatsheet

Bind `?` to open a modal listing every shortcut registered in the current scope:

```svelte
<!-- CheatsheetModal.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { shortcuts } from '$lib/stores/shortcuts.svelte.ts';

	let open = $state(false);

	const unreg = shortcuts.register({
		keys: 'shift+/',
		label: 'Show keyboard shortcuts',
		scope: 'global',
		action: () => (open = !open)
	});
	onDestroy(unreg);

	let visible = $derived(
		shortcuts.all.filter((s) => {
			if (s.scope === 'global') return true;
			return window.location.pathname.startsWith(s.scope);
		})
	);
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') open = false; }} />

{#if open}
	<div class="modal-root">
		<button
			type="button"
			class="overlay"
			aria-label="Close keyboard shortcuts"
			onclick={() => (open = false)}
		></button>
		<div class="sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
			<h2>Keyboard shortcuts</h2>
			<dl>
				{#each visible as s (s.keys)}
					<div>
						<dt>{s.label}</dt>
						<dd><kbd>{s.keys}</kbd></dd>
					</div>
				{/each}
			</dl>
		</div>
	</div>
{/if}
```

Every component that registers a shortcut automatically gets a line in the cheatsheet. Documentation is free.

## Step 5 — Register the core shortcuts

In the `(app)` layout:

```svelte
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { shortcuts } from '$lib/stores/shortcuts.svelte.ts';
	import { goto } from '$app/navigation';

	const cleanups = [
		shortcuts.register({
			keys: 'g+c',
			label: 'Go to contacts',
			scope: 'global',
			action: () => goto('/app')
		}),
		shortcuts.register({
			keys: 'g+a',
			label: 'Go to account',
			scope: 'global',
			action: () => goto('/app/account')
		}),
		shortcuts.register({
			keys: 'cmd+/',
			label: 'Search contacts',
			scope: '/app',
			action: () => document.querySelector<HTMLInputElement>('#search')?.focus()
		})
	];

	onDestroy(() => cleanups.forEach((fn) => fn()));
</script>
```

Two-key chords (`g+c`, `g+a`) are Linear-style navigation. Implementing them needs a tiny extension to the matcher — tracking the `g` key timeout — which is left as a reader exercise; the simpler single-key / modifier shortcuts above are a good starting point.

## Step 6 — Test it

Playwright-based tests for shortcuts are brittle because they often fight OS-level modifier mapping. The smoke tests worth writing:

```ts
test('cmd+k opens command palette', async ({ page }) => {
	await page.goto('/app');
	await page.keyboard.press('Meta+k');
	await expect(page.getByPlaceholder('Type a command…')).toBeVisible();
});

test('n key creates new contact', async ({ page }) => {
	await page.goto('/app');
	await page.keyboard.press('n');
	await expect(page.getByLabel('Name')).toBeVisible();
});

test('n key does nothing when typing in search', async ({ page }) => {
	await page.goto('/app');
	await page.getByPlaceholder('Search contacts').click();
	await page.keyboard.type('nobody');
	await expect(page.getByLabel('Name')).not.toBeVisible();
});
```

## Verify

- `cmd+k` opens the command palette on any route.
- Typing "acc" filters to "Go to account"; Enter navigates.
- `shift+/` (a.k.a. `?`) opens the cheatsheet; shortcut list matches the current route.
- Focusing a text input, pressing `n` → types "n" into the input, doesn't open New contact.
- Pressing `cmd+k` while typing still opens the palette (modifier overrides).

## Common traps

- **Listening globally without the typing guard.** Users type `n` in a search box and suddenly see "Create contact" modal. Your bug tracker will thank you for Step 1's `isTyping()` check.
- **`preventDefault` on unmatched keys.** Break browser shortcuts (find, navigation). Only preventDefault on matches.
- **Cross-OS keybinding assumptions.** `cmd` on macOS is `ctrl` on Windows/Linux. The matcher should accept both (`e.metaKey || e.ctrlKey`).
- **Shortcuts that mutate state without a visual response.** `d` to delete without a confirmation modal is a footgun. Shortcuts should accelerate UI flows, not replace them.
- **Documenting shortcuts in a README only.** Users discover them when the cheatsheet opens in-app. Hide shortcuts in docs = shortcuts nobody uses.

## Recap

Global registry, keyboard listener, palette + cheatsheet. Ten lines to add a new shortcut anywhere in the app. The keyboard becomes a first-class navigation device, and that's what separates apps that feel like products from apps that feel like pages.

Next: [E.9 Rate limiting sensitive endpoints →](./E.9-rate-limiting.md)
