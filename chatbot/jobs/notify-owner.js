require('dotenv').config();

const choices = ['Just starting up now', "Hey, I'm online now"];

const notifyOwner = async () => {
	const owner = process.env.FB_OWNER;
	const api = await require('../api');
	const choice = choices[Math.floor(Math.random() * choices.length)];
	api.sendMessage(choice, owner);
};
notifyOwner();
