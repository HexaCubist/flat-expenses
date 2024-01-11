require('dotenv').config();
const Bree = require('bree');

if (!process.env.FB_APPSTATE) {
	console.log('No appstate found. Please login.');
}

const bree = new Bree({
	jobs: [
		// 'chore-roster',
		// 'bins-reminder'
		{
			name: 'chore-roster',
			// At 7:14am every Monday
			cron: '14 07 * * 1'
		},
		{
			name: 'bins-reminder',
			// Every evening at 4:30pm
			cron: '30 16 * * *'
		}
	]
});

const Graceful = require('@ladjs/graceful');
const graceful = new Graceful({ brees: [bree] });
graceful.listen();
bree.on('worker created', (name) => {
	console.log('worker created', name);
	console.log(bree.workers.get(name));
});

bree.on('worker deleted', (name) => {
	console.log('worker deleted', name);
	console.log(!bree.worker?.has(name));
});

(async () => {
	console.log('Starting jobs...');
	await bree.start();
})();
