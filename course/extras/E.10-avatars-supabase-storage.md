# E.10 — Contact Avatars with Supabase Storage

> The one piece of Contactly that core deliberately deferred. Object storage, signed access, client-side resize, an optimistic upload UI — done right.

## Why this matters

Module 12.2 said it out loud: *"contact avatars are deferred to an Extras lesson."* This is that lesson.

Avatars look trivial — "just upload an image." They are not. A naive implementation ships four production incidents: unbounded file sizes that blow your storage bill, missing access control that leaks every user's images, no image resizing so a 12 MB phone photo renders in a 40 px circle, and a blocking upload that freezes the UI. We'll close all four.

## The Principal Engineer lens

**Storage is a database with worse failure modes.** A row you can't read is an error you handle; an image that 404s is a broken UI nobody notices until a customer screenshots it. Treat the storage bucket with the same rigour as a table: explicit access policies, explicit size limits, explicit content types. "It's just a file" is how data leaks happen.

Corollary: **never trust the client's file.** Size, type, and dimensions are all attacker-controlled. Validate on the client for fast feedback, re-validate on the server because the client validation is a suggestion, not a guarantee.

## Step 1 — Create the storage bucket

Supabase Storage buckets aren't in migrations yet (noted in 12.2). Create it once per environment via SQL so it's at least scripted:

```sql
-- supabase/migrations/20260510000000_avatars_bucket.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,                       -- private; access via signed URLs
  2 * 1024 * 1024,             -- 2 MB hard cap, enforced by Storage itself
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
```

`file_size_limit` and `allowed_mime_types` are enforced by Storage server-side — even a forged client can't exceed them. That is your real defense; the client checks are just UX.

## Step 2 — Storage RLS policies

A bucket without policies is either fully public or fully locked. We want: a user may read and write only objects under their own `user_id/` prefix.

```sql
-- same migration file
create policy "Avatars: read own"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatars: write own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatars: update own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatars: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

The object key convention is `<user_id>/<contact_id>.webp`. `storage.foldername(name)[1]` extracts the first path segment — the user id — and compares it to the caller. This is the exact same ownership model as the `contacts` table RLS from Module 4.1, applied to files.

## Step 3 — Add the column

```sql
-- supabase/migrations/20260510000100_contacts_avatar.sql
alter table public.contacts
  add column avatar_path text;
```

We store the **object path** (`<user_id>/<contact_id>.webp`), never a URL. URLs expire (signed) or leak (public). The path is stable; we mint a fresh signed URL whenever we render.

## Step 4 — Client-side resize before upload

Uploading a 12 MB photo to render at 96 px is wasteful for everyone. Resize in the browser first with a canvas — no dependency needed.

```ts
// src/lib/shared/image.ts
export async function resizeToWebp(
	file: File,
	maxEdge = 256,
	quality = 0.82
): Promise<Blob> {
	const bitmap = await createImageBitmap(file);

	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);

	const canvas = new OffscreenCanvas(w, h);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();

	const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
	if (blob.size > 2 * 1024 * 1024) {
		throw new Error('Image is still too large after resize');
	}
	return blob;
}
```

A 12 MB JPEG becomes a ~15 KB WebP. The Storage cost, the upload time, and the render time all collapse together. `OffscreenCanvas` keeps the resize off the main thread-blocking path.

## Step 5 — The server command

The upload itself goes through a remote `command` so the server controls the object key and writes the `avatar_path` atomically.

```ts
// src/routes/(app)/contacts/avatar.remote.ts
import { command, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';

const UploadSchema = v.object({
	contactId: v.pipe(v.string(), v.uuid()),
	// base64 of the resized webp; small because we resized first
	dataBase64: v.pipe(v.string(), v.maxLength(3_000_000))
});

export const uploadAvatar = command(UploadSchema, async (input) => {
	const event = getRequestEvent();
	const user = requireUser(event);

	// Ownership: the contact must belong to the caller.
	const { data: contact } = await event.locals.supabase
		.from('contacts')
		.select('id')
		.eq('id', input.contactId)
		.eq('user_id', user.id)
		.single();
	if (!contact) throw error(404, 'Contact not found');

	const path = `${user.id}/${input.contactId}.webp`;
	const bytes = Buffer.from(input.dataBase64, 'base64');

	const { error: upErr } = await event.locals.supabaseAdmin.storage
		.from('avatars')
		.upload(path, bytes, { contentType: 'image/webp', upsert: true });
	if (upErr) throw error(500, upErr.message);

	const { error: dbErr } = await event.locals.supabase
		.from('contacts')
		.update({ avatar_path: path })
		.eq('id', input.contactId)
		.eq('user_id', user.id);
	if (dbErr) throw error(500, dbErr.message);

	return { path };
});

export const signAvatarUrl = command(
	v.object({ path: v.string() }),
	async ({ path }) => {
		const event = getRequestEvent();
		const user = requireUser(event);
		if (!path.startsWith(`${user.id}/`)) throw error(403, 'Not your file');

		const { data, error: signErr } = await event.locals.supabase.storage
			.from('avatars')
			.createSignedUrl(path, 60 * 60); // 1-hour URL
		if (signErr) throw error(500, signErr.message);
		return { url: data.signedUrl };
	}
);
```

Two commands, two responsibilities: `uploadAvatar` writes the object and the column in one round trip; `signAvatarUrl` mints a short-lived read URL on demand. The server, not the client, decides the object key — a client can never write `someone-else/...`.

## Step 6 — The `Avatar` display component

A presentational component: show the image if we have one, otherwise initials. No upload logic here.

```svelte
<!-- src/lib/components/Avatar.svelte -->
<script lang="ts">
	interface Props {
		name: string;
		url?: string | null;
		size?: number;
	}
	let { name, url = null, size = 40 }: Props = $props();

	let initials = $derived(
		name
			.split(/\s+/)
			.slice(0, 2)
			.map((s) => s[0]?.toUpperCase() ?? '')
			.join('')
	);
</script>

{#if url}
	<img
		src={url}
		alt={name}
		width={size}
		height={size}
		class="rounded-full object-cover"
		style="width:{size}px;height:{size}px"
	/>
{:else}
	<span
		class="grid place-items-center rounded-full bg-brand-500 font-semibold text-white"
		style="width:{size}px;height:{size}px;font-size:{Math.round(size * 0.4)}px"
		aria-label={name}
	>
		{initials}
	</span>
{/if}
```

## Step 7 — The `AvatarUpload` component

This is where the UX lives: pick a file, resize, preview optimistically, upload, reconcile.

```svelte
<!-- src/lib/components/AvatarUpload.svelte -->
<script lang="ts">
	import { resizeToWebp } from '$lib/shared/image';
	import { uploadAvatar } from '$routes/(app)/contacts/avatar.remote';
	import { toasts } from '$lib/stores/toasts.svelte.ts';
	import Avatar from './Avatar.svelte';

	interface Props {
		contactId: string;
		name: string;
		currentUrl?: string | null;
	}
	let { contactId, name, currentUrl = null }: Props = $props();

	// Local override wins; otherwise fall back to the (reactive) prop.
	let localPreview = $state<string | null>(null);
	let previewUrl = $derived(localPreview ?? currentUrl);
	let busy = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

	async function onPick(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		if (!ACCEPTED.includes(file.type)) {
			toasts.error('Use a JPEG, PNG, or WebP image.');
			return;
		}

		busy = true;
		const objectUrl = URL.createObjectURL(file);
		localPreview = objectUrl; // optimistic

		try {
			const blob = await resizeToWebp(file);
			const dataBase64 = await blobToBase64(blob);
			await uploadAvatar({ contactId, dataBase64 });
			toasts.success('Avatar updated.');
		} catch (err) {
			localPreview = null; // roll back to the server value
			toasts.error(err instanceof Error ? err.message : 'Upload failed.');
		} finally {
			URL.revokeObjectURL(objectUrl);
			busy = false;
			if (inputEl) inputEl.value = ''; // allow re-picking the same file
		}
	}

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				resolve(result.slice(result.indexOf(',') + 1));
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});
	}
</script>

<div class="flex items-center gap-3">
	<div class:opacity-50={busy}>
		<Avatar {name} url={previewUrl} size={64} />
	</div>

	<label class="cursor-pointer rounded-lg border border-border-1 px-3 py-1.5 text-sm text-text-1 hover:bg-surface-0">
		{busy ? 'Uploading…' : 'Change'}
		<input
			bind:this={inputEl}
			type="file"
			accept={ACCEPTED.join(',')}
			class="sr-only"
			disabled={busy}
			onchange={onPick}
		/>
	</label>
</div>
```

The `<input type="file">` is visually hidden (`sr-only`) but wrapped in a `<label>`, so the label *is* the button — keyboard-accessible, screen-reader-correct, no custom ARIA needed. The preview swaps in instantly from a local `objectURL`; the network upload happens behind it; failure rolls the preview back.

## Step 8 — Wire it into the contact row

`signAvatarUrl` is called once when the contact list loads, batched. Simpler: store nothing client-side and resolve URLs in the `getContacts` query, server-side, where the signed URL is cheap to mint:

```ts
// in getContacts (Module 4.5), after fetching rows:
const withAvatars = await Promise.all(
	data.map(async (c) => {
		if (!c.avatar_path) return { ...c, avatarUrl: null };
		const { data: signed } = await event.locals.supabase.storage
			.from('avatars')
			.createSignedUrl(c.avatar_path, 60 * 60);
		return { ...c, avatarUrl: signed?.signedUrl ?? null };
	})
);
return withAvatars;
```

Signed URLs are generated server-side in the same request, cached for an hour by the browser. No extra client round trip per avatar.

## Verify

- Upload a 10 MB phone photo → it resizes to a ~15 KB WebP before leaving the browser (check the Network tab payload size).
- The avatar appears instantly (optimistic), before the upload completes.
- Kill your network mid-upload → the preview rolls back and a toast explains.
- Sign in as another user, copy the first user's `avatar_path`, call `signAvatarUrl` → 403.
- Upload a `.txt` renamed to `.png` → server Storage rejects it (mime mismatch); UI shows the error.
- A contact with no avatar shows initials on a brand-coloured circle.

## Common traps

- **Storing the signed URL in the database.** It expires; you ship dead `<img>` tags. Store the *path*, sign on read.
- **Public bucket "to keep it simple."** Every contact photo every user ever uploaded becomes enumerable. Private bucket + signed URLs, always.
- **Trusting the client resize as the size limit.** It's UX. The Storage `file_size_limit` and the server `maxLength` on the base64 are the actual enforcement.
- **Forgetting `URL.revokeObjectURL`.** Every pick leaks an object URL; a long session bleeds memory. Revoke in `finally`.
- **Not clearing `input.value` after upload.** Picking the same file twice fires no `change` event the second time. Reset it.
- **`upsert: false` on re-upload.** The second avatar for a contact fails with "already exists." Use `upsert: true`; the path is deterministic per contact.

## Recap

Private bucket, prefix-scoped RLS, server-controlled object keys, browser-side resize, optimistic preview with rollback, signed URLs minted on read. The feature core deferred is now the most security-conscious upload flow in the app.

Next: [E.11 Full-text contact search →](./E.11-fulltext-search.md)
