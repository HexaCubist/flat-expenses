<script>
	import '../app.postcss';
</script>

<div class="flex flex-col gap-4 app">
	<div class="nav-wrapper bg-opacity-90 bg-base-100 backdrop-blur">
		<div class="navbar max-w-screen-xl mx-auto">
			<div class="flex-1">
				<a href="/" class="btn btn-ghost normal-case text-xl">House Homies</a>
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
		background-image: url('./assets/flat.jpg');
	}
</style>
