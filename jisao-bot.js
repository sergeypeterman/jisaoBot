const { Telegraf, Markup } = require("telegraf");
const { message } = require("telegraf/filters");
//const fs = require("fs");
const cron = require("node-cron");
const {
  createUser,
  create1hrForecastObject,
  getMinuteDescription,
  getForecast2hr,
  postToBotWeather,
  leadingZero,
  getJisaoDescription,
  getConditionRus,
  setBotObject,
  getChart,
} = require("./jisao-functions");

require("dotenv").config();
const botKeys = process.env.TG_API_KEY;
const weatherKey = process.env.WEATHERAPI_KEY;
const accuweatherKey = process.env.ACCUWEATHER_CORE_KEY;
const accuweatherMinuteKey = process.env.ACCUWEATHER_MINUTE_KEY;

const chatId = process.env.CHAT_ID; //Jisao group id

let accuDefaultLimits = {
  limitMinute: { limitTotal: 25, limitRemain: 25 },
  limitCore: { limitTotal: 50, limitRemain: 50 },
};
if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require("node-localstorage").LocalStorage;
  localStorage = new LocalStorage("./scratch");
}

const localLimits = localStorage.getItem("limits");
if (localLimits) {
  accuDefaultLimits = JSON.parse(localLimits, null, 2);
} else {
  localStorage.setItem("limits", JSON.stringify(accuDefaultLimits, null, 2));
}

let chatData;
(async () => {
  chatData = await createUser(chatId);
})(); //all roads lead to Parede (default home location)

const jisaoBot = new Telegraf(botKeys);
setBotObject(jisaoBot);

//---------------START-----------------
jisaoBot.start(async (ctx) => {
  let replyStart = `Жизяõ ёба хуёба\nДоступные пока команды: 
  • /weather - автоматический прогноз
  • /weather2hr_home - прогноз дома на 2 часа
  • /weather2hr - прогноз в текущей локации на 2 часа
  • /weathertoday - прогноз на сегодня
  • /weathertomorrow - погода на завтра
  • /updatelocation - задать свою локацию`;
  await ctx.reply(replyStart);
});

//==========HOME WEATHER FORECAST========
//---------------weather-----------------
jisaoBot.command("weather", async (ctx) => {
  try {
    const nowTime = new Date();
    //const mins = leadingZero(nowTime.getMinutes());
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

    postToBotWeather(theDay, ctx);
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});

//---------------weathertomorrow-----------------
jisaoBot.command("weathertomorrow", async (ctx) => {
  try {
    const theDay = "tomorrow";

    postToBotWeather(theDay, ctx);
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});

//==========USER WEATHER FORECAST========
jisaoBot.command("weather2hr_home", async (ctx) => {
  try {
    const minuteReply = await getForecast2hr(chatData.userID);
    let forecast2hr = getMinuteDescription(chatData, minuteReply);

    await ctx.reply(forecast2hr);
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});

jisaoBot.command("weather2hr", async (ctx) => {
  try {
    let userID = ctx.from.id;
    const minuteReply = await getForecast2hr(userID);
    if (minuteReply.error.status) {
      throw new Error(minuteReply.error.description);
    }

    let userData;
    if (!localStorage.getItem(`${userID}`)) {
      console.log(`weather2hr: user ${userID} doesn't exist`);
      await ctx.reply(`user ${userID} doesn't exist`);
    } else {
      userData = JSON.parse(localStorage.getItem(`${userID}`));
      console.log(
        `weather2hr: requesting forecast for user ${userData.userID}`
      );
    }

    let forecast2hr = getMinuteDescription(userData, minuteReply);

    await ctx.reply(forecast2hr);
    /* //post limits as well
    await ctx.reply(
      `||limit: ${minuteReply.limitMinute.limitRemain}/${minuteReply.limitMinute.limitTotal}||`,
      { parse_mode: "Markdownv2" }
    ); */
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});

//--------------LOCATION-------------
//-----------------------------------

//ask for user location
jisaoBot.command("updatelocation", async (ctx) => {
  try {
    let userID = ctx.from.id;
    let chatID = ctx.chat.id;
    const checkUserExist = localStorage.getItem(`${userID}`);
    if (!checkUserExist) {
      console.log(
        `command->updatelocation: user ${userID} doesn't exist, creating one`
      );
      await ctx.reply(`ты кто, ${userID}? Записываем-с`);
      const newUser = await createUser(userID);
      newUser.locationUpdateRequested = true;
      console.log(
        `command->updatelocation: user ${newUser.userID} created, default location ${newUser.locationName}, id:${newUser.locationID}, newUser.locationUpdateRequested=${newUser.locationUpdateRequested}`
      );
    } else {
      userData = JSON.parse(checkUserExist);
      userData.locationUpdateRequested = true;
      console.log(
        `command->updatelocation: setting locationUpdateRequested=true ${JSON.stringify(
          userData,
          null,
          2
        )}`
      );
      localStorage.setItem(
        `${userData.userID}`,
        JSON.stringify(userData, null, 2)
      );
    }

    if (chatID > 0) {
      //if we're in chat, not group
      await ctx.reply(
        "ты где ферзь",
        Markup.keyboard([Markup.button.locationRequest("туть")]).resize()
      );
    } else if (chatID < 0) {
      //we're in group
      await ctx.reply(`ты где ферзь (шли локацию)`);
    }
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});

//update user location and store on disk
jisaoBot.on(message("location"), async (ctx) => {
  try {
    const { latitude, longitude } = ctx.message.location;

    const userID = ctx.from.id;
    const checkUserExist = localStorage.getItem(`${userID}`);
    let userData;

    if (!checkUserExist) {
      console.log(`user ${userID} doesn't exist`);
      await ctx.reply(`Юзера №${userID} не знаемс, создаём`);
      const newUser = await createUser(userID, {
        latitude: latitude,
        longitude: longitude,
      });
      console.log(
        `on(message("location"))-> user ${newUser.userID} created, location ${newUser.locationName}, id:${newUser.locationID}, newUser.locationUpdateRequested=${newUser.locationUpdateRequested}`
      );
      await ctx.reply(`попався в ${newUser.locationName}`);

      userData = newUser;
    } else {
      userData = JSON.parse(checkUserExist);
      if (userData.locationUpdateRequested) {
        await ctx.reply(`user ${userData.userID} exists, updating location`);
        userData.location.latitude = latitude;
        userData.location.longitude = longitude;
        userData.locationUpdateRequested = false;

        let queryBase = `http://api.weatherapi.com/v1/forecast.json?key=${weatherKey}`;
        let queryLocationName =
          queryBase + `&q=${latitude},${longitude}&days=1&aqi=no&alerts=no`;
        const locationResponse = await fetch(queryLocationName);
        const locationObj = await locationResponse.json();
        userData.locationName = locationObj.location.name;

        let query = `http://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${accuweatherKey}`;
        query += `&q=${latitude},${longitude}`;
        const response = await fetch(query);
        const geopositionRes = await response.json();
        userData.locationID = geopositionRes.Key;

        localStorage.setItem(`${userID}`, JSON.stringify(userData, null, 2));
      } else {
        await ctx.reply(
          "я и так знаю где ты сидишь, если перелез, жми /updatelocation"
        );
      }
    }

    await ctx.reply(
      `ты нахуя туда залез\nв ${userData.locationName}`,
      Markup.removeKeyboard()
    );
  } catch (err) {
    console.log(err);
    await ctx.reply("ошибка ёба");
  }
});

//reacts on text
jisaoBot.on(message(`text`), async (ctx) => {
  await ctx.reply(
    `ctx.from.id: ${ctx.from.id}, chat:${ctx.chat.id},\nctx: ${JSON.stringify(
      ctx.update,
      null,
      2
    )}`
  );
  if (await getChart(`chart.png`)) {
    await ctx.replyWithPhoto({ source: `temp-images/chart.png` });
  }
});

//---------------CRON-----------------
//------------------------------------
cron.schedule(
  "40 6 * * *", //6.40 every day
  async () => {
    console.log("Scheduling weather post...");
    await jisaoBot.telegram.sendMessage(chatId, `доброго здоровичка`);
    postToBotWeather("today", null, chatId);
  },
  { timezone: "Europe/Lisbon" }
);
cron.schedule(
  "15 22 * * *", //22.15 every day
  async () => {
    console.log("Scheduling weather post...");
    postToBotWeather("tomorrow", null, chatId);
    await jisaoBot.telegram.sendMessage(chatId, `спокедулечки`);
  },
  { timezone: "Europe/Lisbon" }
);

//---------------LAUNCH-----------------
//--------------------------------------
jisaoBot.launch();

//---------------FUNCTIONS-----------------
//-----------------------------------------
// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
