import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine clsx + tailwind-merge so the last class wins when two Tailwind
 * utilities conflict (e.g. `p-2 p-4` becomes `p-4`).
 *
 * Used everywhere we accept a `class` prop.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
