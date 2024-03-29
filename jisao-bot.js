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
} = require("./jisao-functions");

require("dotenv").config();
const botKeys = process.env.TG_API_KEY;
const weatherKey = process.env.WEATHERAPI_KEY;
const accuweatherKey = process.env.ACCUWEATHER_CORE_KEY;
const accuweatherMinuteKey = process.env.ACCUWEATHER_MINUTE_KEY;

const chatId = process.env.CHAT_ID; //Jisao group id

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require("node-localstorage").LocalStorage;
  localStorage = new LocalStorage("./scratch");
}

let chatData;
(async () => {
  chatData = await createUser(chatId);
})(); //all roads lead to Parede. Writing home location for the chat

const jisaoBot = new Telegraf(botKeys);
setBotObject(jisaoBot);

//---------------START-----------------
jisaoBot.start(async (ctx) => {
  await ctx.reply(
    "Жизяõ ёба хуёба\nДоступные пока команды: \n/weather /weatherToday /weatherTomorrow"
  );

  //got chat id
  //const test = await ctx.getChat();
  //console.log(test);
   /* await jisaoBot.telegram.sendMessage(test.id, `||пока||`, {
    parse_mode: "Markdownv2",
  });  */
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
    const minuteReply = await getForecast2hr();
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

    let userData;
    if (!localStorage.getItem(`${userID}`)) {
      console.log(`weather2hr: user ${userID} doesn't exist`);
      await ctx.reply(`user ${userID} doesn't exist`);
    } else {
      userData = JSON.parse(localStorage.getItem(`${userID}`));
      console.log(`weather2hr: user ${userData.userID} exists`);
    }

    let forecast2hr = getMinuteDescription(userData, minuteReply);

    await ctx.reply(forecast2hr);
    await ctx.reply(`||limit: ${minuteReply.limit.limitRemain}/${minuteReply.limit.limitTotal}||`, { parse_mode: "Markdownv2" });
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
    const checkUserExist = localStorage.getItem(`${userID}`);
    if (!checkUserExist) {
      console.log(`user ${userID} doesn't exist`);
      await ctx.reply(`user ${userID} doesn't exist, creating new user`);
      const newUser = await createUser(userID);
      newUser.locationUpdateRequested = true;
      console.log(
        `user ${newUser.userID} created, default location ${newUser.locationName}, id:${newUser.locationID}, newUser.locationUpdateRequested=${newUser.locationUpdateRequested}`
      );
    } else {
      userData = JSON.parse(checkUserExist);
      userData.locationUpdateRequested = true;
      console.log(`user exists ${JSON.stringify(userData, null, 2)}`);
      localStorage.setItem(
        `${userData.userID}`,
        JSON.stringify(userData, null, 2)
      );
    }

    await ctx.reply(
      "ты где ферзь",
      Markup.keyboard([Markup.button.locationRequest("туть")]).resize()
    );
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
      await ctx.reply(`user ${userID} doesn't exist, creating new user`);
      const newUser = await createUser(userID, {
        latitude: latitude,
        longitude: longitude,
      });
      await ctx.reply(
        `user ${newUser.userID} created, location ${newUser.locationName}, id:${newUser.locationID}, newUser.locationUpdateRequested=${newUser.locationUpdateRequested}`
      );
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
        await ctx.reply("я и так знаю где ты сидишь, жми /updatelocation");
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
