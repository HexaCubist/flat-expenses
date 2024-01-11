require('dotenv').config();

// Get bin day from council website
const fetch = require('node-fetch');
const { parse } = require('node-html-parser');
const dayjs = require('dayjs');

const sendMessage = async () => {
	const thread = process.env.FB_THREAD;
	const res = await fetch(process.env.BIN_URL).then((res) => res.text());
	const root = parse(res);
	const nextDay = root.querySelectorAll('.card-content .links .m-r-1')[0]?.textContent;
	if (!nextDay) return;
	const now = dayjs();
	const bins = dayjs(nextDay);
	const isRecycling = root
		.querySelectorAll('.card-content div.links')[0]
		?.querySelector('.icon-recycle');
	if (now.date() === bins.date() && now.month() === bins.month()) {
		let message = `The bins need to go out tonight!`;
		if (isRecycling) {
			message = `The recycling bins need to go out tonight!`;
		}
		const api = await require('../api');
		api.sendMessage(message, owner);
	} else {
		console.log(
			`The bins aren't going out tonight. The next time is ${nextDay} and ${
				isRecycling ? 'the recycling bins are going out' : "the recycling bins aren't going out"
			}.`
		);
	}
};
sendMessage();
