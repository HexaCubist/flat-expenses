require('dotenv').config();

// Get bin day from council website
const fetch = require('node-fetch');
const { parse } = require('node-html-parser');
const dayjs = require('dayjs');

const sendMessage = async () => {
	const thread = process.env.FB_THREAD;
	const res = await fetch(process.env.BIN_URL).then((res) => res.text());
	const root = parse(res);
	const now = dayjs();
	const [rubbishDay, scrapDay, recyclingDay] = Array.from(
		root.querySelectorAll('.collectionDayDate strong')
	).map((c) => dayjs(c.textContent).set('y', now.year()));
	const nextDate = dayjs(Math.min(rubbishDay, scrapDay, recyclingDay));
	let prefix = '';
	let listOfBins = [];
	if (nextDate === rubbishDay) {
		prefix = '🗑️';
		listOfBins.push('rubbish');
	}
	if (nextDate === scrapDay) {
		prefix = '🌿';
		listOfBins.push('food scraps');
	}
	if (nextDate === recyclingDay) {
		prefix = '♻️';
		listOfBins.push('recycling');
	}
	if (!nextDate) return;
	if (now.add(1, 'd') >= bins) {
		const message = `${prefix} The ${listOfBins.join(
			', '
		)} need to go out tonight for collection tomorrow!`;
		const api = await require('../api');
		api.sendMessage(message, thread);
	} else {
		console.log(
			`The bins aren't going out tonight. The next time is ${nextDate} and ${
				isRecycling ? 'the recycling bins are going out' : "the recycling bins aren't going out"
			}`
		);
	}
};
sendMessage();
