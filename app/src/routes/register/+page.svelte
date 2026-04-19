<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import { register } from './auth.remote';
</script>

<section class="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
	<div class="card p-8">
		<h1 class="text-2xl font-semibold tracking-tight">Register for an account</h1>
		<p class="mt-1 text-sm text-fg-muted">Free forever. Upgrade anytime.</p>

		<form {...register} class="mt-6 flex flex-col gap-4">
			<Input label="Name" type="text" autocomplete="name" {...register.fields.full_name.as('text')} />
			<Input label="Email" type="email" autocomplete="email" {...register.fields.email.as('email')} />
			<Input label="Password" type="password" autocomplete="new-password" {...register.fields._password.as('password')} />
			<Input label="Confirm password" type="password" autocomplete="new-password" {...register.fields._confirm.as('password')} />

			{#if register.result?.error}
				<p class="text-sm text-danger">{register.result.error}</p>
			{/if}

			<Button type="submit" full loading={!!register.pending}>Register</Button>
		</form>

		<p class="mt-6 text-center text-sm text-fg-muted">
			Already have an account? <a href="/login" class="font-medium text-brand-400 hover:underline">Sign in</a>
		</p>
	</div>
</section>
