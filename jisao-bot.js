const { Telegraf } = require("telegraf");
const cron = require("node-cron");

require("dotenv").config();
const botKeys = process.env.TG_API_KEY;
const weatherKey = process.env.WEATHERAPI_KEY;

const jisaoBot = new Telegraf(botKeys);
const chatIdBot = 56421333; //chat-id of the bot itself
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
    const nowTime = new Date();
    const mins = leadingZero(nowTime.getMinutes());
    const hrs = leadingZero(nowTime.getHours());
    const theDay = hrs > 18 ? "tomorrow" : "today";

    postToBotWeather(theDay, ctx);
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
  "10 22 * * *", //22.00 every day
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
async function postToBotWeather(day, ctx = null, targetchat = chatIdBot) {
  try {
    let queryBase = `http://api.weatherapi.com/v1/forecast.json?key=${weatherKey}`;
    let query2days = queryBase + `&q=Parede&days=2&aqi=no&alerts=yes`;

    const weatherResponse = await fetch(query2days);
    const weather = await weatherResponse.json();
    const condResponse = await fetch(
      "https://www.weatherapi.com/docs/conditions.json"
    );
    const conditionResponse = await condResponse.json();
    //console.log(conditionResponse[0]);
    const getCondition = getConditionRus(weather.current, conditionResponse);
    const currentCondition =
      getCondition === undefined ? null : `, ${getCondition}`;

    console.log(query2days);

    let dayToPost = day === "today" ? 0 : 1;
    const theDayRus =
      day === "today" ? "сегодня ожидаются" : "завтра обещаются";

    const forecast = weather.forecast.forecastday[dayToPost];
    const jisao = getJisaoDescription(forecast.day, conditionResponse);

    let stringPost = `Кстати, погодки в ${weather.location.name} ${theDayRus} ${jisao.whole}`;
    stringPost += `, ${jisao.condition}\n`;
    stringPost += `\n☀️ ${jisao.day},\n🌙 ${jisao.night},\n\n`;
    stringPost += `💦 ${jisao.rain},\n`;
    stringPost += `😎 ${jisao.uv}`;
    stringPost += `\n\nсейчас ${weather.current.temp_c}°C${currentCondition}`;

    if (ctx === null) {
      await jisaoBot.telegram.sendMessage(targetchat, stringPost, {
        parse_mode: "Markdown",
      });
    } else if (ctx) {
      await ctx.reply(stringPost, { parse_mode: "Markdown" });
    } else {
      throw new Error("error, context ctx doesn't exist");
    }
  } catch (err) {
    console.log("error:", err);
    jisaoBot.telegram.sendMessage(chatIdBot, err);
  }
}

//add 0 to a 2-digit num (hours and minutes)
function leadingZero(num) {
  let withZero = "";

  withZero = "0" + num;

  return withZero.slice(-2);
}

//describe jisao
function getJisaoDescription(day, codeList) {
  const jisao = {
    whole: "",
    day: "",
    night: "",
    rain: "",
    uv: "",
    isRain: "",
    condition: "",
  };
  const weather = {
    day: day.maxtemp_c,
    night: day.mintemp_c,
    rainChance: day.daily_chance_of_rain,
    rainMm: day.totalprecip_mm,
    uv: day.uv,
  };

  jisao.isRain = day.daily_will_it_rain ? ", дождь" : null;
  jisao.condition = getConditionRus(day, codeList);

  if (weather.day < 14) {
    jisao.whole = "холодрыговые";
  } else if (weather.day < 19) {
    jisao.whole = "прохладновые";
  } else if (weather.day < 26) {
    jisao.whole = "распрекрасные";
  } else if (weather.day < 31) {
    jisao.whole = "жарищевые";
  } else {
    jisao.whole = "сковородовые";
  }

  if (weather.night < 10) {
    jisao.night = `*${Math.round(weather.night)}°C*, ночью дубак`;
  } else if (weather.night < 15) {
    jisao.night = `*${Math.round(weather.night)}°C*, ночью прохладно`;
  } else if (weather.night < 21) {
    jisao.night = `*${Math.round(weather.night)}°C*, ночью тепло`;
  } else {
    jisao.night = `*${Math.round(weather.night)}°C*, ночью потеем`;
  }

  if (weather.day < 10) {
    jisao.day = `*${Math.round(weather.day)}°C*, днём носим два пухана`;
  } else if (weather.day < 16) {
    jisao.day = `*${Math.round(weather.day)}°C*, днём носим пухан`;
  } else if (weather.day < 21) {
    jisao.day = `*${Math.round(weather.day)}°C*, днём курточка`;
  } else if (weather.day < 26) {
    jisao.day = `*${Math.round(weather.day)}°C*, днём футболочка`;
  } else {
    jisao.day = `*${Math.round(weather.day)}°C*, днём пиздос`;
  }

  if (weather.rainMm < 1) {
    jisao.rain = `сухо`;
  } else if (weather.rainMm < 5) {
    jisao.rain = `${weather.rainMm}мм сыроватости, поливабилити ${weather.rainChance}%`;
  } else if (weather.rainMm < 10) {
    jisao.rain = `${weather.rainMm}мм мокроватости, поливабилити ${weather.rainChance}%`;
  } else if (weather.rainMm < 15) {
    jisao.rain = `${weather.rainMm}мм лужеватости, поливабилити ${weather.rainChance}%`;
  } else if (weather.rainMm < 30) {
    jisao.rain = `${weather.rainMm}мм ливневатости, поливабилити ${weather.rainChance}%`;
  } else {
    jisao.rain = `${weather.rainMm}мм потопа, поливабилити ${weather.rainChance}%`;
  }

  if (weather.uv < 3) {
    jisao.uv = `UV = ${weather.uv}, солнце где-то есть`;
  } else if (weather.uv < 5) {
    jisao.uv = `UV = ${weather.uv}, солнце фигачит`;
  } else if (weather.uv < 8) {
    jisao.uv = `UV = ${weather.uv}, надо вмазаться`;
  } else if (weather.uv < 10) {
    jisao.uv = `UV = ${weather.uv}, шляпу гусям`;
  } else {
    jisao.uv = `UV = ${weather.uv}, пизда гусю`;
  }

  return jisao;
}

//condition in rus
function getConditionRus(day, codeList) {
  let conditionRus;
  let conditionCode = day.condition.code;

  const codeListItem = codeList.find((item) => item.code === conditionCode);

  const conditionObjRus = codeListItem.languages.find(
    (item) => item.lang_name === "Russian"
  );

  conditionRus =
    conditionObjRus === undefined
      ? undefined
      : conditionObjRus.day_text.toLowerCase();

  return conditionRus;
}
