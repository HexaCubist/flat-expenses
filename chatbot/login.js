const login = require('@xaviabot/fca-unofficial');
const fs = require('fs');
require('dotenv').config();

const credentials = {
	email: process.env.FB_EMAIL,
	password: process.env.FB_PASSWORD
};

login(credentials, (err, api) => {
	if (err) {
		switch (err.error) {
			case 'login-approval':
				console.log('Enter code > ');
				rl.on('line', (line) => {
					err.continue(line);
					rl.close();
				});
				break;
			default:
				console.error(err);
		}
		return;
	}
	fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
});
