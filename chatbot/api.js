const login = require('@xaviabot/fca-unofficial');

require('dotenv').config();
const p = new Promise((resolve, reject) => {
	login({ appState: JSON.parse(process.env.FB_APPSTATE) }, (err, api) => {
		if (err) reject(err);
		resolve(api);
	});
});

module.exports = p;
