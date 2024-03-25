const { Telegraf } = require("telegraf");
const cron = require("node-cron");

require("dotenv").config();
const botKeys = process.env.TG_API_KEY;
const weatherKey = process.env.WEATHERAPI_KEY;

const jisaoBot = new Telegraf(botKeys);
//const chatId = 56421333; chat-id of the bot itself
const chatId = -4153236668;


//---------------START-----------------
jisaoBot.start(async (ctx) => {
  await ctx.reply(
    "Жизяõ ёба хуёба\nДоступные пока команды: \n/weather /weatherToday /weatherTomorrow"
  );
  //got chat id
  //const test = await ctx.getChat();
  //await ctx.reply(JSON.stringify(test));
});


//---------------weather-----------------
jisaoBot.command("weather", async (ctx) => {
  try {
    ctx.reply(`пиздеther`);

    /*await ctx.reply(
      `Погодки в ${weather.location.name} стоят распрекрасные, ${weather.current.temp_c}°C`
    );*/

    const nowTime = new Date();
    const mins = leadingZero(nowTime.getMinutes());
    const hrs = leadingZero(nowTime.getHours());
    const theDay = hrs > 18 ? "tomorrow" : "today";

    postToBotWeather(theDay);

  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});


//---------------weathertoday-----------------
jisaoBot.command("weathertoday", async (ctx) => {
  try {
    const theDay = "today";

    postToBotWeather(theDay);
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});


//---------------weathertomorrow-----------------
jisaoBot.command("weathertomorrow", async (ctx) => {
  try {
    const theDay = "tomorrow";

    postToBotWeather(theDay);
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});


//---------------CRON-----------------
//------------------------------------
cron.schedule(
  "45 6 * * *", //6.45 every day
  async () => {
    console.log("Scheduling weather post...");
    await jisaoBot.telegram.sendMessage(chatId, `доброго здоровичка`);
    postToBotWeather("today");
  },
  { timezone: "Europe/Lisbon" }
);
cron.schedule(
  "2 22 * * *", //22.00 every day
  async () => {
    console.log("Scheduling weather post...");
    await jisaoBot.telegram.sendMessage(chatId, `спокедулечки`);
    postToBotWeather("tomorrow");
  },
  { timezone: "Europe/Lisbon" }
);

//---------------LAUNCH-----------------
//--------------------------------------
jisaoBot.launch();


//---------------FUNCTIONS-----------------
//-----------------------------------------
async function postToBotWeather(day) {
  let queryBase = `http://api.weatherapi.com/v1/forecast.json?key=${weatherKey}`;
  let query2days = queryBase + `&q=Parede&days=2&aqi=no&alerts=yes`;

  const weatherResponse = await fetch(query2days);
  const weather = await weatherResponse.json();

  console.log(query2days);

  let dayToPost = day === "today" ? 0 : 1;
  const theDayRus = day === "today" ? "сегодня ожидаются" : "завтра обещаются";

  const forecast = weather.forecast.forecastday[dayToPost];

  let stringPost = `Кстати, погодки в ${weather.location.name} ${theDayRus} хуёвые,\n`;
  stringPost += `от ${forecast.day.mintemp_c}°C до ${forecast.day.maxtemp_c}°C,\n`;
  stringPost += `вероятность дождя ${forecast.day.daily_chance_of_rain}%,`;
  stringPost +=
    forecast.day.daily_chance_of_rain > 0.1
      ? ` до ${forecast.day.totalprecip_mm}мм,`
      : null;
  stringPost += `\n\nсейчас ${weather.current.temp_c}°C`;

  await jisaoBot.telegram.sendMessage(chatId, stringPost);
}

//add 0 to a 2-digit num (hours and minutes)
function leadingZero(num) {
  let withZero = "";

  withZero = "0" + num;

  return withZero.slice(-2);
}
