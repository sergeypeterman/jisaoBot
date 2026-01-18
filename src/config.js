const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../.env') });

// Verify all required environment variables are loaded
console.log('Environment check:');
// console.log('AccuWeather Core Key exists:', !!process.env.ACCUWEATHER_CORE_KEY);
// console.log('AccuWeather Minute Key exists:', !!process.env.ACCUWEATHER_MINUTE_KEY);
console.log('Weather API Key exists:', !!process.env.WEATHERAPI_KEY);
console.log('Pirate Weather Key exists:', !!process.env.P_WEATHER_KEY);
console.log('Bot ID exists:', !!process.env.BOT_ID);
console.log('Chat ID exists:', !!process.env.CHAT_ID);

const stars = `\n*****************************\n`;
const chatIdBot = process.env.BOT_ID; //chat-id of my chat with bot
const weatherKey = process.env.WEATHERAPI_KEY;
// const accuweatherKey = process.env.ACCUWEATHER_CORE_KEY;
// const accuweatherMinuteKey = process.env.ACCUWEATHER_MINUTE_KEY;
const pirateWeatherKey = process.env.P_WEATHER_KEY;
const homeChatId = process.env.CHAT_ID; //Jisao group id

module.exports = {
  stars,
  chatIdBot,
  weatherKey,
//   accuweatherKey,
//   accuweatherMinuteKey,
  pirateWeatherKey,
  homeChatId,
};
