<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import { login } from './auth.remote';
</script>

<section class="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
	<div class="card p-8">
		<h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
		<p class="mt-1 text-sm text-fg-muted">Sign in to manage your contacts.</p>

		<form {...login} class="mt-6 flex flex-col gap-4">
			<Input label="Email" type="email" autocomplete="email" {...login.fields.email.as('email')} />
			<Input label="Password" type="password" autocomplete="current-password" {...login.fields._password.as('password')} />

			{#if login.result?.error}
				<p class="text-sm text-danger">{login.result.error}</p>
			{/if}

			<Button type="submit" full loading={!!login.pending}>Sign in</Button>
		</form>

		<p class="mt-6 text-center text-sm text-fg-muted">
			No account? <a href="/register" class="font-medium text-brand-400 hover:underline">Create one</a>
		</p>
	</div>
</section>
