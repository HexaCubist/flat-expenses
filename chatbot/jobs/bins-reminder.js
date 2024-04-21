require('dotenv').config();

// Get bin day from council website
const fetch = require('node-fetch');
const { parse } = require('node-html-parser');
const dayjs = require('dayjs');
const minMax = require('dayjs/plugin/minMax');
const LocalizedFormat = require('dayjs/plugin/LocalizedFormat');
dayjs.extend(minMax);
dayjs.extend(LocalizedFormat);

const sendMessage = async () => {
	const thread = process.env.FB_THREAD;
	const res = await fetch(process.env.BIN_URL).then((res) => res.text());
	const root = parse(res);
	const now = dayjs().set('h', 0).set('m', 0).set('s', 0).set('ms', 0);
	const [rubbishDay, scrapDay, recyclingDay] = Array.from(
		root.querySelectorAll('.collectionDayDate strong')
	).map((c) => dayjs(c.textContent).set('y', now.year()));
	const nextDate = dayjs.min(rubbishDay, scrapDay, recyclingDay);
	let prefix = '';
	let listOfBins = [];
	console.log(nextDate, rubbishDay);
	if (nextDate.isSame(rubbishDay)) {
		prefix = '🗑️';
		listOfBins.push('rubbish');
	}
	if (nextDate.isSame(scrapDay)) {
		prefix = '🌿';
		listOfBins.push('food scraps');
	}
	if (nextDate.isSame(recyclingDay)) {
		prefix = '♻️';
		listOfBins.push('recycling');
	}
	if (!nextDate) {
		console.log('No bins found');
		return;
	}
	if (now.add(1, 'd').isSame(nextDate)) {
		const message = `${prefix} The ${listOfBins.join(
			', '
		)} need to go out tonight for collection tomorrow!`;
		const api = await require('../api');
		api.sendMessage(message, thread);
	} else {
		console.log(
			`The bins aren't going out tonight. The next time is ${nextDate.format(
				'L LT'
			)}. The current time is ${now.format('L LT')} and will trigger on ${nextDate
				.subtract(1, 'd')
				.format('L LT')}. The message will be ${prefix}:${listOfBins.join(
				','
			)}. Details: Rubbish:${rubbishDay.format('L LT')}, Scrap:${scrapDay.format(
				'L LT'
			)}, Recycling:${recyclingDay.format('L LT')}`
		);
	}
};
sendMessage();
