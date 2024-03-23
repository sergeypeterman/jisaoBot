const { Telegraf } = require("telegraf");

require('dotenv').config();
const botKeys = process.env.API_KEY;

const jisaoBot = new Telegraf(botKeys);

jisaoBot.start(ctx => ctx.reply('Жизяõ ёба хуёба'));
jisaoBot.launch();
