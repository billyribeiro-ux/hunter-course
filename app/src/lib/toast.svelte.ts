import { nanoid } from 'nanoid';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
	id: string;
	kind: ToastKind;
	message: string;
}

/**
 * Toast store — a tiny in-memory queue. Components read `toast.items`
 * reactively; callers push with `toast.success('…')` etc.
 */
function createToast() {
	let items = $state<ToastItem[]>([]);

	function push(kind: ToastKind, message: string, ttl = 4000) {
		const id = nanoid(6);
		items = [...items, { id, kind, message }];
		setTimeout(() => dismiss(id), ttl);
	}

	function dismiss(id: string) {
		items = items.filter((t) => t.id !== id);
	}

	return {
		get items() {
			return items;
		},
		success: (m: string) => push('success', m),
		error: (m: string) => push('error', m),
		info: (m: string) => push('info', m),
		dismiss
	};
}

export const toast = createToast();
