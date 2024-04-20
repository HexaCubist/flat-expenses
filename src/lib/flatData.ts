import { env } from '$env/dynamic/public';
import type { Transaction, TransactionType } from 'akahu';
import type { AccountBalance, AccountRefreshState } from 'akahu/dist/models/accounts';
import { DateTime, Settings } from 'luxon';
Settings.defaultWeekSettings = {
	firstDay: 6,
	minimalDays: 1,
	weekend: [6, 7]
};

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
		public rent: RentAdjustment[],
		public start: DateTime,
		public balanceAdjust: BalanceAdjustment[],
		public account: string
	) {}
	get balance(): number {
		return this.myBalanceAt(DateTime.now());
	}
	myRentAt(date: DateTime): number {
		return this.rent.find((r) => r.end_date === -1 || r.end_date >= date.toSeconds())?.amount || 0;
	}
	myBalanceAt(date: DateTime): number {
		const txs = this.state.txs.filter(
			(tx) =>
				tx.person === this &&
				DateTime.fromISO(tx.date) <= date &&
				DateTime.fromISO(tx.date) >= this.start
		);
		const startDate = FlatData.weekStart(
			this.state.firstDate < this.start ? this.start : this.state.firstDate
		);
		// console.log(this.state.firstDate.toSeconds(), this.balanceAdjust);
		return (
			Math.round(
				txs.reduce(
					(acc, tx) => acc + tx.amount,
					0 -
						Math.max(
							0,
							// Starting balance charge
							this.balanceAdjust
								.filter((b) => b.date >= this.state.firstDate.toSeconds())
								.reduce((acc, b) => b.amount + acc, 0) +
								//  Weekly rent and utilties since startDate
								// Loop over weeks since start
								[...Array(Math.max(0, Math.ceil(date.diff(startDate, 'weeks').weeks)))].reduce(
									(acc, _, i) => {
										// First, get the date of the start of the week
										const weekStart = startDate.plus({ weeks: i });
										return acc + this.myRentAt(weekStart) + utility_cost;
									},
									0
								)
						)
				) * 100
			) / 100
		);
	}
	myTxsInRange(t: TimePeriod): FlatTransaction[] {
		return t.txs.filter((tx) => tx.person === this);
	}
}

export enum flatTxType {
	flatmateCredit,
	landlord,
	power,
	internet,
	water,
	power_internet_bundled,
	other
}

export const flatTxTypes = [
	flatTxType.flatmateCredit,
	flatTxType.landlord,
	flatTxType.power,
	flatTxType.internet,
	flatTxType.water,
	flatTxType.power_internet_bundled,
	flatTxType.other
];

export const nonFlatmateTypes = flatTxTypes.filter((type) => type !== flatTxType.flatmateCredit);

export const flatTxStyles = {
	[flatTxType.flatmateCredit]: {
		emoji: '🏠',
		colour: 'rgb(255, 99, 132)',
		name: 'Rent'
	},
	[flatTxType.landlord]: {
		emoji: '🏠',
		colour: 'rgb(255, 159, 64)',
		name: 'Landlord Debit'
	},
	[flatTxType.power]: {
		emoji: '💡',
		colour: 'rgb(54, 162, 235)',
		name: 'Power'
	},
	[flatTxType.internet]: {
		emoji: '🌐',
		colour: 'rgb(54, 162, 235)',
		name: 'Internet'
	},
	[flatTxType.water]: {
		emoji: '💧',
		colour: 'rgb(54, 162, 235)',
		name: 'Water'
	},
	[flatTxType.power_internet_bundled]: {
		emoji: '💡🌐',
		colour: 'rgb(54, 162, 235)',
		name: 'Utilities'
	},
	[flatTxType.other]: {
		emoji: '🏠',
		colour: 'rgb(210 209 209)',
		name: 'Other'
	}
};

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
					return flatTxType.power_internet_bundled;
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

interface FlatDataOptions {
	showAllTime: boolean;
	startDate?: DateTime;
}

type BalanceAdjustment = { amount: number; date: number };
type RentAdjustment = { amount: number; end_date: number };
type PeopleEnvMap = Record<
	string,
	{
		rent: RentAdjustment[];
		start_date: number;
		balance_adjustments: BalanceAdjustment[];
		search_name: string;
	}
>;

export class FlatData {
	txs: FlatTransaction[];
	people: Person[];
	options: FlatDataOptions;
	constructor(
		public data: {
			account: {
				name: string;
				balance: AccountBalance | undefined;
				refreshed: AccountRefreshState | undefined;
			};
			transactions: Pick<Transaction, 'date' | 'description' | 'amount' | 'balance' | 'type'>[];
		},
		options: Partial<FlatDataOptions> = {}
	) {
		this.options = {
			showAllTime: false,
			...options
		};
		// Parse PUBLIC_PEOPLE_MAP
		const peopleMap = JSON.parse(env.PUBLIC_PEOPLE_MAP) as PeopleEnvMap;
		this.people = Object.entries(peopleMap).map(([name, info]) => {
			return new Person(
				this,
				name,
				info.rent,
				DateTime.fromSeconds(info.start_date),
				info.balance_adjustments,
				info.search_name
			);
		});
		this.txs = data.transactions
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((tx) => {
				return new FlatTransaction(this, tx);
			});
	}
	get firstDate(): DateTime {
		const realFirstDate = this.txs[0]?.date
			? DateTime.fromISO(this.txs[0]?.date)
			: DateTime.now().minus({ days: 30 });
		// Case 1: first date at least one flatmate has moved in
		if (this.options.showAllTime || this.people.find((p) => p.start <= realFirstDate)) {
			return this.options.startDate || realFirstDate;
		}
		// Case 2: first date no flatmate has moved in, return the first date a flatmate moves in
		return this.people.map((p) => p.start).sort()[0];
	}
	get lastDate() {
		return DateTime.now();
	}
	/**
	 * Get the start of the week that the date is in
	 * In our flat, weeks start on a satuday
	 **/
	static weekStart(date: DateTime) {
		return date.startOf('week', { useLocaleWeeks: true });
		// .minus({ days: 2 });
	}
	weekStart(date: DateTime) {
		return FlatData.weekStart(date);
	}
	get weeks() {
		const weeks = [];
		let week = FlatData.weekStart(this.firstDate);
		while (week < this.lastDate) {
			weeks.push(new Week(this, week));
			week = week.plus({ weeks: 1 });
		}
		return weeks;
	}
	get days() {
		const days = [];
		let day = this.firstDate.startOf('day');
		while (day < this.lastDate) {
			days.push(new Day(this, day));
			day = day.plus({ days: 1 });
		}
		return days;
	}
}

export class TimePeriod {
	constructor(
		private state: FlatData,
		public start: DateTime,
		public end: DateTime,
		public filter: (tx: FlatTransaction) => boolean = () => true
	) {}
	get txs(): FlatTransaction[] {
		return this.state.txs.filter(this.filter).filter((tx) => {
			const txDate = DateTime.fromISO(tx.date);
			return txDate >= this.start && txDate < this.end;
		});
	}
	get delta(): number {
		return this.txs.reduce((acc, tx) => acc + tx.amount, 0);
	}
	/**
	 * Balance at the end of the time period
	 */
	get balance(): number {
		return (
			this.txs[this.txs.length - 1]?.balance ||
			this.state.txs.toReversed().find((tx) => DateTime.fromISO(tx.date) < this.end)?.balance ||
			0
		);
	}
	get txOfTypes() {
		return Object.fromEntries(
			flatTxTypes.map<[flatTxType, TimePeriod]>((type) => {
				return [
					type,
					new TimePeriod(
						this.state,
						this.start,
						this.end,
						(tx) => tx.FlatTxType === type && this.filter(tx)
					)
				];
			})
		);
	}
}

export class Week extends TimePeriod {
	constructor(state: FlatData, start: DateTime, filter?: (tx: FlatTransaction) => boolean) {
		super(state, start, start.plus({ weeks: 1 }), filter);
	}
}

export class Day extends TimePeriod {
	constructor(state: FlatData, start: DateTime, filter?: (tx: FlatTransaction) => boolean) {
		super(state, start, start.plus({ days: 1 }), filter);
	}
}
