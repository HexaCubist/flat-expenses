<script>
	import { page } from '$app/stores';
	import '../app.postcss';
</script>

<div class="flex flex-col gap-4 app">
	<div class="nav-wrapper bg-opacity-90 bg-base-100 backdrop-blur">
		<div class="navbar max-w-screen-xl mx-auto">
			<div class="flex-1">
				<a href="/" class="btn btn-ghost normal-case text-xl">Riukiuta Retreat</a>
				<a href="/days-30" class="btn normal-case" class:btn-ghost={$page.params.time !== 'days-30'}
					>30 Days</a
				>
				<a href="/" class="btn normal-case" class:btn-ghost={$page.params.time}>80 Days</a>
				<a
					href="/2024-01-01"
					class="btn normal-case"
					class:btn-ghost={$page.params.time !== '2024-01-01'}>Since 2024</a
				>
				<a
					href="/flat-start"
					class="btn normal-case"
					class:btn-ghost={$page.params.time !== 'flat-start'}>Flat Started</a
				>
				<a href="/start" class="btn normal-case" class:btn-ghost={$page.params.time !== 'start'}
					>All Time</a
				>
			</div>
		</div>
	</div>
	<div class="px-2 flex flex-col gap-4">
		<slot />
	</div>
</div>

<style lang="postcss">
	:global(body) {
		@apply bg-cover bg-center min-h-screen;
		background-image: url('./assets/tunnel.jpg');
	}
</style>
