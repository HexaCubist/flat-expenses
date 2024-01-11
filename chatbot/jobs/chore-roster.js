require('dotenv').config();

// Chores:
// 1. Mow / sweep / tidy outdoors
// 2. Downstairs floors and bin cleanup and to the road
// 3. Kitchen and surfaces wipe down
// 4. Upstairs floors and declutterer / organiser

const chores = [
	'🪴 Mow / sweep / tidy outdoors',
	'🗑️ Downstairs floors and bin cleanup and to the road',
	'🧑‍🍳 Kitchen and surfaces wipe down',
	'🧹 Upstairs floors and declutterer / organiser'
];

const people = ['Sebastian', 'Ben', 'Darcey', 'Zac'];

const sendMessage = async () => {
	const thread = process.env.FB_THREAD;
	const api = await require('../api');
	const weekRot = Math.floor(((Date.now() + 345_600_000) / 604_800_000) % 4);
	// Offset chores by week rotation
	const offsetChores = chores.slice(weekRot).concat(chores.slice(0, weekRot));
	const message = offsetChores.map((chore, i) => `${people[i]}: ${chore}`).join('\n');
	api.sendMessage(
		`The chores for the coming week are:

${message}`,
		thread
	);
};
sendMessage();
