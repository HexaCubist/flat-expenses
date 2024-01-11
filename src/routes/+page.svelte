<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { Chart as ChartEl } from 'svelte-chartjs';
	import {
		Chart,
		Colors,
		Title,
		CategoryScale,
		Legend,
		LinearScale,
		PointElement,
		BarElement,
		LineElement,
		Tooltip
	} from 'chart.js';
	import 'chart.js/auto';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { DateTime } from 'luxon';
	import type { ChartData, LineController } from 'chart.js';
	import { env } from '$env/dynamic/public';
	import type { Point } from 'chart.js/dist/core/core.controller';
	import 'chartjs-adapter-luxon';
	import {
		FlatData,
		utility_cost,
		flatTxType,
		flatTxStyles,
		nonFlatmateTypes
	} from '$lib/flatData';

	Chart.register(
		Colors,
		Title,
		Tooltip,
		Legend,
		LinearScale,
		PointElement,
		BarElement,
		LineElement,
		CategoryScale
	);

	$: data = $page.data as PageData;

	$: flatData = new FlatData(data);

	const formatDollars = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'NZD',
		currencyDisplay: 'narrowSymbol',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	let balanceData: ChartData<'line' | 'bar'>;
	$: balanceData = {
		labels: flatData.days.map((d) => d.start),
		datasets: [
			{
				type: 'line',
				label: 'Balance',
				data: flatData.days.map((d) => ({
					x: d.start,
					y: d.balance
				})),
				fill: false,
				borderColor: 'rgb(75, 192, 192)',
				tension: 0
			},
			{
				type: 'bar',
				label: 'Rent Payments',
				stack: 'stack 0',
				backgroundColor: flatTxStyles[flatTxType.flatmateCredit].colour,
				data: flatData.days.map((d) => ({
					x: d.start,
					y: d.txOfTypes[flatTxType.flatmateCredit].delta
				}))
			},
			{
				type: 'bar',
				label: 'Landlord Payments',
				stack: 'stack 0',
				backgroundColor: flatTxStyles[flatTxType.landlord].colour,
				data: flatData.days.map((d) => ({
					x: d.start,
					y: d.txOfTypes[flatTxType.landlord].delta
				}))
			},
			{
				type: 'bar',
				label: 'Utilities',
				stack: 'stack 0',
				backgroundColor: flatTxStyles[flatTxType.power_internet_bundled].colour,
				data: flatData.days.map((d) => ({
					x: d.start,
					y:
						d.txOfTypes[flatTxType.power_internet_bundled].delta +
						d.txOfTypes[flatTxType.internet].delta +
						d.txOfTypes[flatTxType.power].delta +
						d.txOfTypes[flatTxType.water].delta
				}))
			},
			{
				type: 'bar',
				label: 'Other Transactions',
				stack: 'stack 0',
				backgroundColor: flatTxStyles[flatTxType.other].colour,
				data: flatData.days.map((d) => ({
					x: d.start,
					y: d.txOfTypes[flatTxType.other].delta
				}))
			}
		]
	};
</script>

<div
	class="card w-full bg-opacity-90 bg-base-100 backdrop-blur-lg shadow-lg max-w-screen-xl m-auto"
>
	<div class="card-body">
		<h1 class="text-2xl">
			{data.account.name}
		</h1>
		{#if balanceData}
			<div class="w-full h-80">
				<ChartEl
					type={'line'}
					data={balanceData}
					width={100}
					height={30}
					options={{
						plugins: {
							tooltip: {
								callbacks: {
									label: function (context) {
										const label = context.dataset.label || '';
										if (label) {
											return label + ': ' + formatDollars.format(context.parsed.y);
										}
										return formatDollars.format(context.parsed.y);
									}
								}
							}
						},
						maintainAspectRatio: false,
						scales: {
							x: {
								type: 'time',
								time: {
									// Luxon format string
									tooltipFormat: 'ccc, LLLL d',
									unit: 'day',
									displayFormats: {
										day: 'ccc, dd/MM'
									}
								}
							},
							y: {
								beginAtZero: true,
								stacked: true,
								min: -2000,
								max: 2500,

								ticks: {
									// Include a dollar sign in the ticks
									callback: function (value, index, values) {
										if (typeof value === 'string') {
											return value;
										}
										return new Intl.NumberFormat('en-US', {
											style: 'currency',
											currency: 'NZD',
											currencyDisplay: 'narrowSymbol',
											minimumFractionDigits: 0,
											maximumFractionDigits: 0
										}).format(value);
									}
								}
							}
						},
						interaction: {
							mode: 'point'
						}
					}}
				/>
			</div>
		{/if}
	</div>
</div>

<!-- Rent table -->
<div class="card w-full bg-base-100 shadow-xl max-w-screen-2xl m-auto">
	<div class="card-body">
		<h2 class="text-xl">Rent</h2>
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Date</th>
						{#each flatData.people as person}
							<th>
								{person.name}
								<br />
								🏡{formatDollars.format(person.rent)} 🔋{formatDollars.format(utility_cost)}
								<div class="float-right">
									{#if person.balance > 0}
										<span class="badge-simple badge-success">
											▲
											{formatDollars.format(person.balance)}
										</span>
									{:else if person.balance === 0}
										<span class="badge-simple">
											{formatDollars.format(person.balance)}
										</span>
									{:else}
										<span class="badge-simple badge-error">
											▼
											{formatDollars.format(person.balance)}
										</span>
									{/if}
								</div>
							</th>
						{/each}
						<th>Other Transactions</th>
					</tr>
				</thead>
				<tbody>
					{#each flatData.weeks.toReversed() as week, weekIndex}
						<tr>
							<th title="Week starting {week.start.toLocaleString()}">
								{week.start.toRelative({ unit: 'weeks' })}
								<br />
								{#if week.delta > 0}
									<span class="badge-simple badge-success">
										▲
										{formatDollars.format(week.delta)}
									</span>
								{:else}
									<span class="badge-simple badge-error">
										▼
										{formatDollars.format(week.delta)}
									</span>
								{/if}
							</th>
							{#each flatData.people as person, personIndex}
								{@const balance = person.myBalanceAt(week.end)}
								{@const weekTx = person.myTxsInRange(week)}
								{@const weekSum = weekTx.reduce((acc, tx) => acc + tx.amount, 0)}
								{@const hasBalance = weekSum - utility_cost - (person.rent || 0) >= 0}
								{#if person.start > week.end}
									<td class="relative leading-6 align-middle text-center select-none">
										<span class="text-sm font-light text-gray-300 italic">
											Not a flatmate yet!
										</span>
									</td>
								{:else}
									<td class="relative leading-6 align-bottom">
										{#if weekTx.length > 0}
											{#each weekTx as tx}
												<div
													class="tooltip w-full block text-left"
													data-tip="{tx.date}: {tx.description}"
												>
													<span
														class="badge badge-outline"
														class:badge-error={!hasBalance}
														class:badge-success={hasBalance && tx.amount >= 0}
													>
														{formatDollars.format(tx.amount)}
													</span>
												</div>
											{/each}
										{:else if person.balance >= 0}
											<span
												class="badge badge-lg"
												title="Person has positive balance - may have paid 2x rent last week or made it up"
												>⏭️</span
											>
										{:else}
											<span class="badge badge-lg">❌</span>
										{/if}
										<div
											class="bg-base-200 w-full -ml-2 -mr-2 mt-2 relative p-1 rounded-t text-xs text-base-content text-opacity-70 font-bold"
										>
											Total: {formatDollars.format(weekSum)}
											<br />
											Balance: {formatDollars.format(balance)}
										</div>
									</td>
								{/if}
							{/each}
							<td class="relative">
								<div class="flex flex-wrap gap-1">
									{#each nonFlatmateTypes as type}
										{#each week.txOfTypes[type].txs as tx}
											<div class="tooltip" data-tip={tx.description}>
												<span class="badge badge-xs sm:text-base sm:badge-md w-full"
													>{flatTxStyles[type].emoji} {formatDollars.format(tx.amount)}</span
												>
											</div>
										{/each}
									{/each}
								</div>
								<div class="h-5 w-full" />
								<div
									class="bg-base-200 bottom-0 left-0 right-0 mx-auto p-1 absolute rounded-t text-xs text-base-content text-opacity-70 font-bold"
									style="width: calc(100% - 2rem);"
								>
									Change: {formatDollars.format(
										nonFlatmateTypes.reduce((acc, type) => acc + week.txOfTypes[type].delta, 0)
									)}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<style lang="postcss">
	.badge-simple {
		@apply badge badge-outline badge-sm sm:text-base sm:badge-md;
		@apply truncate;
	}
</style>
