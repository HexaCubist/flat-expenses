import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { AkahuClient, type Transaction, type TransactionQueryParams } from 'akahu';
import { DateTime } from 'luxon';
import fetchAdapter from '@haverstack/axios-fetch-adapter';
import { PUBLIC_START_DATE } from '$env/static/public';
import { FlatData } from '$lib/flatData';

const { app_token, user_token, account_name } = env;

if (!app_token || !user_token || !account_name) throw new Error('Missing Akahu tokens');
const akahu = new AkahuClient({
	appToken: app_token,
	adapter: fetchAdapter
});

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const user = await akahu.users.get(user_token);
	const accounts = await akahu.accounts.list(user_token);
	const account = accounts.find((account) => account.name === account_name);

	if (!account) throw new Error(`No account found with name "${account_name}"`);
	let startDate = FlatData.weekStart(
		DateTime.now()
			.setZone(env.TZ || 'Pacific/Auckland')
			.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
			.minus({ days: 80 })
	);
	switch (params.time) {
		case 'days-30':
			startDate = FlatData.weekStart(
				DateTime.now()
					.setZone(env.TZ || 'Pacific/Auckland')
					.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
					.minus({ days: 30 })
			);
			break;
		case 'start':
			startDate = FlatData.weekStart(
				DateTime.fromSeconds(parseInt(PUBLIC_START_DATE))
					.setZone(env.TZ || 'Pacific/Auckland')
					.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
					.minus({ days: 80 })
			);
			break;
		case 'flat-start':
			startDate = FlatData.weekStart(
				DateTime.fromSeconds(parseInt(PUBLIC_START_DATE))
					.setZone(env.TZ || 'Pacific/Auckland')
					.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
			);
			break;
		default:
			if (params.time) {
				const newStartDate = FlatData.weekStart(
					DateTime.fromFormat(params.time, 'yyyy-MM-dd')
						.setZone(env.TZ || 'Pacific/Auckland')
						.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
				);
				if (newStartDate && newStartDate > DateTime.now().minus({ years: 1 })) {
					startDate = newStartDate;
				}
			}
			break;
	}
	const start = startDate.toUTC().toISO();
	if (!start) throw new Error('Could not generate start date');

	const transactions: Pick<Transaction, 'date' | 'description' | 'amount' | 'balance' | 'type'>[] =
		[];
	const query: TransactionQueryParams = { start };
	do {
		// Transactions are returned one page at a time
		const page = await akahu.transactions.list(user_token, query);
		// Store the returned transaction `items` from each page
		transactions.push(
			...page.items
				.filter((transaction) => transaction._account === account._id)
				.map(({ date, description, amount, balance, type }) => ({
					date,
					description,
					amount,
					balance,
					type
				}))
		);
		// Update the cursor to point to the next page
		query.cursor = page.cursor.next;
		// Continue until the server returns a null cursor
	} while (query.cursor !== null);

	setHeaders({
		'X-Robots-Tag': 'noindex',
		'cache-control': 'public, max-age 43200, s-maxage=43200, stale-while-revalidate=43200'
	});

	return {
		account: {
			name: account.name,
			balance: account.balance,
			refreshed: account.refreshed
		},
		transactions,
		startDate: startDate.toISO()
	};
};
