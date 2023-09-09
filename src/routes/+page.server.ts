import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { AkahuClient, type Transaction, type TransactionQueryParams } from 'akahu';
import { DateTime } from 'luxon';

const { app_token, user_token, account_name } = env;

if (!app_token || !user_token || !account_name) throw new Error('Missing Akahu tokens');

const akahu = new AkahuClient({ appToken: app_token });
const user = await akahu.users.get(user_token);
const accounts = await akahu.accounts.list(user_token);
const account = accounts.find((account) => account.name === account_name);

if (!account) throw new Error(`No account found with name "${account_name}"`);

export const load: PageServerLoad = async ({ params }) => {
	const start = DateTime.now()
		.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
		.minus({ days: 90 })
		.toUTC()
		.toISO();
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

	return {
		account: {
			name: account.name,
			balance: account.balance,
			refreshed: account.refreshed
		},
		transactions
	};
};
