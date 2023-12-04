import { env } from '$env/dynamic/public';
import type { Transaction, TransactionType } from 'akahu';
import type { AccountBalance, AccountRefreshState } from 'akahu/dist/models/accounts';
import { DateTime } from 'luxon';

export const landlord = env.PUBLIC_LANDLORD;

export const water = env.PUBLIC_WATER || 'water';
export const internet = env.PUBLIC_INTERNET || 'internet';
export const power = env.PUBLIC_POWER || 'power';
export const power_bundled = power === internet;
export const utility_cost = Number(env.PUBLIC_UTILITIES);

export const formatDollars = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'NZD',
	currencyDisplay: 'narrowSymbol',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export class Person {
	constructor(
		private state: FlatData,
		public name: string,
		public rent: number,
		public start: DateTime,
		public balanceChange: number,
		public account: string
	) {}
	get;
}

enum flatTxType {
	flatmateCredit,
	landlord,
	power,
	internet,
	water,
	power_water_bundled,
	other
}

export class FlatTransaction
	implements Pick<Transaction, 'description' | 'date' | 'amount' | 'balance' | 'type'>
{
	description: string;
	date: string;
	amount: number;
	balance?: number | undefined;
	type: TransactionType;
	constructor(
		private state: FlatData,
		{
			description,
			date,
			amount,
			balance,
			type
		}: Pick<Transaction, 'description' | 'date' | 'amount' | 'balance' | 'type'>
	) {
		// Load in initial values
		this.description = description;
		this.date = date;
		this.amount = amount;
		this.balance = balance;
		this.type = type;
	}
	get FlatTxType(): flatTxType {
		if (this.person) {
			return flatTxType.flatmateCredit;
		} else {
			if (this.description.toLowerCase().includes(landlord.toLowerCase())) {
				return flatTxType.landlord;
			} else if (this.description.toLowerCase().includes(water.toLowerCase())) {
				return flatTxType.water;
			} else if (power_bundled) {
				if (this.description.toLowerCase().includes(power.toLowerCase())) {
					return flatTxType.power_water_bundled;
				}
			} else {
				if (this.description.toLowerCase().includes(power.toLowerCase())) {
					return flatTxType.power;
				} else if (this.description.toLowerCase().includes(internet.toLowerCase())) {
					return flatTxType.internet;
				}
			}
			return flatTxType.other;
		}
	}
	get person(): Person | false {
		return (
			this.state.people.find((p) =>
				this.description.toLowerCase().includes(p.account.toLowerCase())
			) || false
		);
	}
}

export class FlatData {
	txs: FlatTransaction[];
	people: Person[];
	constructor(
		public data: {
			account: {
				name: string;
				balance: AccountBalance | undefined;
				refreshed: AccountRefreshState | undefined;
			};
			transactions: Pick<Transaction, 'date' | 'description' | 'amount' | 'balance' | 'type'>[];
		}
	) {
		this.people = env.PUBLIC_PEOPLE_MAP.split(',').map((p) => {
			const [name, rent, startTime, balanceChange = 0, account = name] = p.split(':');
			return new Person(
				name,
				Number(rent),
				DateTime.fromSeconds(Number(startTime)),
				Number(balanceChange),
				account
			);
		});
		this.txs = data.transactions
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((tx) => {
				return new FlatTransaction(this, tx);
			});
	}
	get firstDate(): DateTime {
		return this.txs[0]?.date
			? DateTime.fromISO(this.txs[0]?.date)
			: DateTime.now().minus({ days: 30 });
	}
	get lastDate() {
		return DateTime.now();
	}
}
