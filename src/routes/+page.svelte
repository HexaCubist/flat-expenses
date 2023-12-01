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

	const landlord = env.PUBLIC_LANDLORD;
	enum utility {
		power,
		internet,
		water,
		power_water_bundled
	}
	const water = env.PUBLIC_WATER || 'water';
	const internet = env.PUBLIC_INTERNET || 'internet';
	const power = env.PUBLIC_POWER || 'power';
	const power_bundled = power === internet;
	const utility_cost = Number(env.PUBLIC_UTILITIES);
	const people = env.PUBLIC_PEOPLE_MAP.split(',').map((p) => {
		const [name, rent, startTime, balanceChange = 0, account = name] = p.split(':');
		return {
			name,
			account,
			rent: Number(rent),
			start: DateTime.fromSeconds(Number(startTime)),
			balanceChange: Number(balanceChange)
		};
	});
	const isPersonTx = (tx: { description: string }) => {
		return people.find((p) => tx.description.toLowerCase().includes(p.account.toLowerCase()));
	};
	const isPersonRent = (tx: { description: string; amount?: number }, loose = false) => {
		return people.find(
			(p) =>
				isPersonTx(tx) &&
				(loose || tx.description.toLowerCase().includes('rent')) &&
				tx.amount &&
				tx.amount >= p.rent
		);
	};
	const isPersonUtility = (tx: { description: string; amount?: number }) => {
		return people.find(
			(p) =>
				isPersonTx(tx) &&
				(tx.description.toLowerCase().includes('utility') ||
					tx.description.toLowerCase().includes('bill')) &&
				tx.amount &&
				tx.amount >= utility_cost
		);
	};
	const isLandlordTx = (tx: { description: string }) => {
		return tx.description.toLowerCase().includes(landlord.toLowerCase());
	};
	const isUtilityTx = ({ description }: { description: string }) => {
		if (description.toLowerCase().includes(water.toLowerCase())) {
			return utility.water;
		} else if (power_bundled) {
			if (description.toLowerCase().includes(power.toLowerCase())) {
				return utility.power_water_bundled;
			}
		} else {
			if (description.toLowerCase().includes(power.toLowerCase())) {
				return utility.power;
			} else if (description.toLowerCase().includes(internet.toLowerCase())) {
				return utility.internet;
			}
		}
		return false;
	};

	$: data = $page.data as PageData;

	const formatDollars = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'NZD',
		currencyDisplay: 'narrowSymbol',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	$: sortedDates = data.transactions.sort((a, b) => a.date.localeCompare(b.date));
	$: firstDate = sortedDates[0]?.date
		? DateTime.fromISO(sortedDates[0]?.date)
		: DateTime.now().minus({ days: 30 });
	$: lastDate = sortedDates[sortedDates.length - 1]?.date
		? DateTime.fromISO(sortedDates[sortedDates.length - 1]?.date)
		: DateTime.now();

	$: dayRange = Math.ceil(lastDate.diff(firstDate, 'days').days);
	$: timePeriodDays = Array.from(Array(dayRange).keys())
		.map((i) => lastDate.minus({ days: i }))
		.reverse();
	// env.PUBLIC_START_DATE == 1701082800
	$: richDataRange = Math.max(
		Math.ceil(lastDate.diff(DateTime.fromSeconds(parseInt(env.PUBLIC_START_DATE)), 'weeks').weeks),
		1
	);
	$: richTimePeriodWeeks = Array.from(Array(richDataRange).keys()).map((i) =>
		DateTime.fromSeconds(parseInt(env.PUBLIC_START_DATE)).plus({ weeks: i })
	);

	$: activityByDay = data.transactions.reduce<Record<string, typeof data.transactions>>(
		(acc: any, t: any) => {
			const date = DateTime.fromISO(t.date as string).toISODate()!;
			if (acc[date]) {
				acc[date].push(t);
			} else {
				acc[date] = [t];
			}
			return acc;
		},
		Object.fromEntries(timePeriodDays.map((d) => [d.toISODate(), []]))
	);
	let runningDayBalance: number[] = [];
	$: timePeriodDays.forEach((d) => {
		const dayActivities = activityByDay[d.toISODate()!][activityByDay[d.toISODate()!].length - 1];
		runningDayBalance.push(
			dayActivities?.balance === undefined
				? runningDayBalance[runningDayBalance.length - 1]
				: dayActivities.balance
		);
	});

	$: richWeekData = richTimePeriodWeeks.map((week) => {
		const weekTransactions = data.transactions.filter((t) => {
			const date = DateTime.fromISO(t.date as string).startOf('day');
			return date >= week.startOf('week') && date <= week.endOf('week');
		});
		const flatmateTx = people.reduce((acc, person) => {
			const personTransactions = weekTransactions.filter((t) =>
				t.description.toLowerCase().includes(person.account.toLowerCase())
			);
			let RentTx = personTransactions.find((t) => isPersonRent(t))?.amount || false;
			let UtilityTx = personTransactions.find((t) => isPersonUtility(t))?.amount || false;
			let OtherTx = personTransactions
				.filter((t) => !isPersonRent(t) && !isPersonUtility(t))
				.reduce((acc, t) => acc + t.amount, 0);
			if (RentTx === false && OtherTx > person.rent) {
				RentTx = person.rent;
				OtherTx -= person.rent;
			}
			if (UtilityTx === false && OtherTx > utility_cost) {
				UtilityTx = utility_cost;
				OtherTx -= utility_cost;
			}
			if ((RentTx || 0) >= person.rent + utility_cost) {
				UtilityTx = (RentTx || 0) - person.rent;
				RentTx = person.rent;
			}
			const personBalance = personTransactions.reduce((acc, t) => acc + t.amount, 0);
			return {
				...acc,
				[person.name]: {
					transactions: personTransactions,
					balance: personBalance,
					rent: RentTx || 0,
					utility: UtilityTx || 0
				}
			};
		}, {} as Record<string, { transactions: typeof weekTransactions; balance: number; rent: false | number; utility: false | number }>);
		const otherTx = weekTransactions.filter(
			(t) => !people.some((p) => t.description.toLowerCase().includes(p.account.toLowerCase()))
		);
		const otherBalance = otherTx.reduce((acc, t) => acc + t.amount, 0);
		return {
			week,
			flatmateTx,
			otherTx,
			otherBalance,
			change: weekTransactions.reduce((acc, t) => acc + t.amount, 0)
		};
	});

	$: weeklyPersonRunningBalance = people.map((person) => {
		// Array of balances for each week, starting from the first week and accumulating
		return richWeekData?.reduce<number[]>(
			(acc, week) => {
				if (person.start > week.week) return acc;
				return [
					...acc,
					acc[acc.length - 1] +
						(week.flatmateTx[person.name].transactions.reduce((acc, t) => acc + t.amount, 0) || 0) -
						person.rent -
						utility_cost
				];
			},
			[person.balanceChange * -1]
		);
	});

	let balanceData: ChartData<'line' | 'bar'>;
	$: balanceData = {
		labels: timePeriodDays,
		datasets: [
			{
				type: 'line',
				label: 'Balance',
				data: timePeriodDays.map((d) => ({
					x: d,
					y: runningDayBalance[
						timePeriodDays.map((d) => d.toLocaleString()).indexOf(d.toLocaleString())
					]
				})),
				// data: Object.entries(activityByDay).map(([d, t], idx) => ({
				// 	x: timePeriodDays.map((d) => d.toLocaleString()).indexOf(d),
				// 	y:
				// 		t[0]?.balance ||
				// 		(idx > 0 ? (balanceData?.datasets[0]?.data[idx - 1] as Point | undefined)?.y || 0 : 0)
				// })),
				fill: false,
				borderColor: 'rgb(75, 192, 192)',
				tension: 0
			},
			{
				type: 'bar',
				label: 'Rent Payments',
				stack: 'stack 0',
				backgroundColor: 'rgb(255, 99, 132)',
				data: Object.entries(activityByDay).map(([d, t]) => ({
					x: DateTime.fromISO(d),
					y: t.reduce((acc, t) => {
						if (isPersonRent(t, true)) {
							return acc + t.amount;
						}
						return acc;
					}, 0)
				}))
			},
			{
				type: 'bar',
				label: 'Landlord Payments',
				stack: 'stack 0',
				backgroundColor: 'rgb(255, 159, 64)',
				data: Object.entries(activityByDay).map(([d, t]) => ({
					x: DateTime.fromISO(d),
					y: t.reduce((acc, t) => {
						if (isLandlordTx(t)) {
							return acc + t.amount;
						}
						return acc;
					}, 0)
				}))
			},
			{
				type: 'bar',
				label: 'Utilities',
				stack: 'stack 0',
				backgroundColor: 'rgb(54, 162, 235)',
				data: Object.entries(activityByDay).map(([d, t]) => ({
					x: DateTime.fromISO(d),
					y: t.reduce((acc, t) => {
						if (isUtilityTx(t) !== false) {
							return acc + t.amount;
						}
						return acc;
					}, 0)
				}))
			},
			{
				type: 'bar',
				label: 'Other Transactions',
				stack: 'stack 0',
				data: Object.entries(activityByDay).map(([d, t]) => ({
					x: DateTime.fromISO(d),
					y: t.reduce((acc, t) => {
						if (isUtilityTx(t) === false && !isLandlordTx(t) && !isPersonRent(t, true)) {
							return acc + t.amount;
						}
						return acc;
					}, 0)
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
						{#each people as person, personIndex}
							{@const balance =
								weeklyPersonRunningBalance[personIndex][
									weeklyPersonRunningBalance[personIndex].length - 1
								]}
							<th>
								{person.name}
								<br />
								🏡{formatDollars.format(person.rent)} 🔋{formatDollars.format(utility_cost)}
								<div class="float-right">
									{#if balance > 0}
										<span class="badge-simple badge-success">
											▲
											{formatDollars.format(balance)}
										</span>
									{:else if balance === 0}
										<span class="badge-simple">
											{formatDollars.format(balance)}
										</span>
									{:else}
										<span class="badge-simple badge-error">
											▼
											{formatDollars.format(balance)}
										</span>
									{/if}
								</div>
							</th>
						{/each}
						<th>Other Transactions</th>
					</tr>
				</thead>
				<tbody>
					{#each richWeekData.reverse() as week, weekIndex}
						<tr>
							<th title="Week starting {week.week.toLocaleString()}">
								{week.week.toRelative({ unit: 'weeks' })}
								<br />
								{#if week.change > 0}
									<span class="badge-simple badge-success">
										▲
										{formatDollars.format(week.change)}
									</span>
								{:else}
									<span class="badge-simple badge-error">
										▼
										{formatDollars.format(week.change)}
									</span>
								{/if}
							</th>
							{#each people as person, personIndex}
								{@const balance =
									weeklyPersonRunningBalance[personIndex][
										weeklyPersonRunningBalance[personIndex].length - 1 - weekIndex
									]}
								{@const personData = week.flatmateTx[person.name]}

								<td class="relative leading-6 align-bottom">
									{#if personData.transactions.length > 0}
										{#each personData.transactions as tx}
											{@const hasBalance =
												personData.balance - utility_cost - (personData.rent || 0) > 0}
											<div
												class="tooltip w-full block text-left"
												data-tip="{tx.date}: {tx.description}"
											>
												<span
													class="badge badge-outline"
													class:badge-error={!hasBalance}
													class:badge-success={hasBalance && tx.amount > 0}
												>
													{formatDollars.format(tx.amount)}
												</span>
											</div>
										{/each}
									{:else if balance >= 0}
										<span
											class="badge badge-lg"
											title="Person has positive balance - may have paid 2x rent last week">⏭️</span
										>
									{:else}
										<span class="badge badge-lg">❌</span>
									{/if}
									<div
										class="bg-base-200 w-full -ml-2 -mr-2 mt-2 relative p-1 rounded-t text-xs text-base-content text-opacity-70 font-bold"
									>
										Total: {formatDollars.format(personData.balance)} Balance: {formatDollars.format(
											balance
										)}
									</div>
								</td>
							{/each}
							<td class="relative">
								<div class="flex flex-wrap gap-1">
									{#each week.otherTx as tx}
										<div class="tooltip" data-tip={tx.description}>
											<span class="badge badge-xs sm:text-base sm:badge-md w-full"
												>{formatDollars.format(tx.amount)}</span
											>
										</div>
									{/each}
								</div>
								<div class="h-5 w-full" />
								<div
									class="bg-base-200 bottom-0 left-0 right-0 mx-auto p-1 absolute rounded-t text-xs text-base-content text-opacity-70 font-bold"
									style="width: calc(100% - 2rem);"
								>
									{formatDollars.format(week.otherBalance)}
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
