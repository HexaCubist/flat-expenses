require('dotenv').config();
const Bree = require('bree');

if (!process.env.FB_APPSTATE) {
	console.log('No appstate found. Please login.');
}

const bree = new Bree({
	jobs: [
		// 'chore-roster',
		'bins-reminder',
		{
			name: 'chore-roster',
			// At 7:14am every Monday
			cron: process.env.CRON_CHORE_ROSTER
		}
		// {
		// 	name: 'bins-reminder',
		// 	// Every evening at 4:30pm
		// 	cron: process.env.CRON_BINS_REMINDER
		// }
	]
});

const Graceful = require('@ladjs/graceful');
const graceful = new Graceful({ brees: [bree] });
graceful.listen();
bree.on('worker created', (name) => {
	console.log('worker created', name);
	// console.log(bree.workers.get(name));
});

bree.on('worker deleted', (name) => {
	console.log('worker deleted', name);
	// console.log(!bree.worker?.has(name));
});

(async () => {
	console.log('Starting jobs...');
	await bree.start();
})();
