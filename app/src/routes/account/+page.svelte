<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import { toast } from '$lib/toast.svelte';
	import {
		updateProfile,
		updateEmail,
		updatePassword,
		openBillingPortal,
		signOut
	} from './account.remote';
	import type { PageData } from './$types';

	interface Props { data: PageData; }
	let { data }: Props = $props();
</script>

<section class="mx-auto max-w-3xl space-y-10 px-6 py-12">
	<!-- Current plan & billing -->
	<div>
		<div class="flex items-center gap-2">
			<span class="text-fg-muted">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 17H4a2 2 0 01-2-2V9a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-.5"/><path d="M12 12l4 4-4 4-4-4z"/></svg>
			</span>
			<h2 class="text-xl font-semibold">Current Plan &amp; Billing</h2>
		</div>
		<p class="mt-1 text-sm text-fg-muted">Manage your current plan and billing details</p>
		<p class="mt-5">Current Plan: <strong class="capitalize">{data.tier}</strong></p>
		<form
			{...openBillingPortal.enhance(async ({ submit }) => {
				const res = await submit();
				if (res?.url) window.location.href = res.url;
				else if (res?.error) toast.error(res.error);
			})}
			class="mt-4"
		>
			<Button type="submit" loading={!!openBillingPortal.pending}>Manage Billing</Button>
		</form>
	</div>

	<div class="divider"></div>

	<!-- Personal details -->
	<div>
		<div class="flex items-center gap-2">
			<span class="text-fg-muted">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
			</span>
			<h2 class="text-xl font-semibold">Personal Details</h2>
		</div>
		<p class="mt-1 text-sm text-fg-muted">Change the personal details associated with your account</p>
		<form
			{...updateProfile.enhance(async ({ submit }) => {
				const res = await submit();
				if (res?.ok) toast.success('Profile updated.');
				else if (res?.error) toast.error(res.error);
			})}
			class="mt-5 max-w-md"
		>
			<Input label="Name" {...updateProfile.fields.full_name.as('text', data.profile?.full_name ?? '')} />
			<div class="mt-4">
				<Button type="submit" loading={!!updateProfile.pending}>Update Details</Button>
			</div>
		</form>
	</div>

	<div class="divider"></div>

	<!-- Email -->
	<div>
		<div class="flex items-center gap-2">
			<span class="text-fg-muted">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
			</span>
			<h2 class="text-xl font-semibold">Email Address</h2>
		</div>
		<p class="mt-1 text-sm text-fg-muted">Change the email associated with your account</p>
		<form
			{...updateEmail.enhance(async ({ submit }) => {
				const res = await submit();
				if (res?.ok) toast.success('Check your inbox to confirm the new email.');
				else if (res?.error) toast.error(res.error);
			})}
			class="mt-5 max-w-md"
		>
			<Input label="Email" type="email" {...updateEmail.fields.email.as('email', data.user?.email ?? '')} />
			<div class="mt-4">
				<Button type="submit" loading={!!updateEmail.pending}>Update Email</Button>
			</div>
		</form>
	</div>

	<div class="divider"></div>

	<!-- Password -->
	<div>
		<div class="flex items-center gap-2">
			<span class="text-fg-muted">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
			</span>
			<h2 class="text-xl font-semibold">Password</h2>
		</div>
		<p class="mt-1 text-sm text-fg-muted">Change the password associated with your account</p>
		<form
			{...updatePassword.enhance(async ({ submit, form }) => {
				const res = await submit();
				if (res?.ok) {
					toast.success('Password changed.');
					form.reset();
				} else if (res?.error) {
					toast.error(res.error);
				}
			})}
			class="mt-5 max-w-md space-y-4"
		>
			<Input label="New Password" type="password" autocomplete="new-password" {...updatePassword.fields._password.as('password')} />
			<Input label="Confirm New Password" type="password" autocomplete="new-password" {...updatePassword.fields._confirm.as('password')} />
			<Button type="submit" loading={!!updatePassword.pending}>Change Password</Button>
		</form>
	</div>

	<div class="divider"></div>

	<!-- Sign out -->
	<div>
		<form {...signOut}>
			<Button type="submit" variant="secondary" loading={!!signOut.pending}>Sign out</Button>
		</form>
	</div>
</section>
