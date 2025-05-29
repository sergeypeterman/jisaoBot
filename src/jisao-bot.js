const { Telegraf, Markup } = require("telegraf");
const { message } = require("telegraf/filters");
const fs = require("fs");
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
  getMinuteChart,
  getPirateForecast2hr,
  getLocationDescription,
  getDayChart,
} = require("./jisao-functions");

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Verify the environment variables are loaded
console.log("Environment check:");
console.log("AccuWeather Key exists:", !!process.env.ACCUWEATHER_CORE_KEY);
console.log("Weather API Key exists:", !!process.env.WEATHERAPI_KEY);

const botKeys = process.env.TG_API_KEY;
const weatherKey = process.env.WEATHERAPI_KEY;
const accuweatherKey = process.env.ACCUWEATHER_CORE_KEY;
const accuweatherMinuteKey = process.env.ACCUWEATHER_MINUTE_KEY;

const homeChatId = process.env.CHAT_ID; //Jisao group id

let defaultLimits = {
  limitMinute: { limitTotal: 25, limitRemain: 25 },
  limitCore: { limitTotal: 50, limitRemain: 50 },
  limitPirate: { limitTotal: 10000, limitRemain: 10000 },
};
if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require("node-localstorage").LocalStorage;
  localStorage = new LocalStorage("../scratch");
}

const localLimits = localStorage.getItem("limits");
if (localLimits) {
  defaultLimits = JSON.parse(localLimits, null, 2);
} else {
  localStorage.setItem("limits", JSON.stringify(defaultLimits, null, 2));
}

let chatData;
(async () => {
  chatData = await createUser(homeChatId);
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
  • /updatelocation - задать свою локацию
  • /updatehomelocation - задать домашнюю локацию`;
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

    const { precipIntensity, precipType, averagePrecip } =
      await getPirateForecast2hr(userID);

    minuteReply.precipIntensity = precipIntensity;
    minuteReply.precipType = precipType;
    minuteReply.averagePrecip = averagePrecip;

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

    //await ctx.reply(forecast2hr);

    //forging data
    //get 120 min from accuweather for rain(true\false), and extend 60 min of pirate(mm\hr) with average
    let data = { precipIntensity: [], minutes: [] };
    data.precipIntensity = minuteReply.precipIntensity;
    data.minutes = new Array(120).fill(0).reduce((acc, item, ind) => {
      acc.push(ind);
      if (data.precipIntensity[ind] === undefined) {
        data.precipIntensity.push(minuteReply.forecast12hr[1].rain);
      }
      return acc;
    }, []);

    console.log(`accuweather: ${minuteReply.precipAccuArr}`);
    console.log(`pirate precipIntensity: ${data.precipIntensity}`);
    console.log(
      `forecast12hr[0]: ${JSON.stringify(minuteReply.forecast12hr[0])}`
    );
    console.log(
      `forecast12hr[1]: ${JSON.stringify(minuteReply.forecast12hr[1])}`
    );
    //filtering out pirate weather minute values, based on accuweather 0\1\..
    for (let i = 0; i < data.precipIntensity.length; i++) {
      if (minuteReply.precipAccuArr[i]) {
        if (data.precipIntensity[i] === 0) {
          let hour = Math.floor(i / 60);
          console.log(`hour: ${hour}`);
          if (!minuteReply.forecast12hr[hour].rain) {
            data.precipIntensity[i] = minuteReply.averagePrecip;
          } else {
            data.precipIntensity[i] = minuteReply.forecast12hr[hour].rain;
          }
        }
      } else {
        data.precipIntensity[i] = 0;
      }
    }
    console.log(`finally: ${data.precipIntensity}`);

    if (minuteReply.averagePrecip > -0.02) {
      await getMinuteChart(`minute.png`, data);
      const chartFilename = `../temp-images/minute.png`;

      fs.access(chartFilename, fs.constants.F_OK, async (err) => {
        if (err) {
          console.error(`${filePath} does not exist`);
          ctx.reply(`график тогось`);
        } else {
          await ctx.replyWithPhoto(
            { source: chartFilename },
            { caption: forecast2hr }
          );
        }
      });
    }
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

//set home location
jisaoBot.command("updatehomelocation", async (ctx) => {
  try {
    let userID = ctx.from.id;
    let chatID = ctx.chat.id;

    //using chatData
    chatData.locationUpdateRequested = true;

    if (chatID > 0) {
      //if we're in chat, not group
      await ctx.reply(
        "где живёшь ферзь (шли локацию)",
        Markup.keyboard([Markup.button.locationRequest("туть")]).resize()
      );
    } else if (chatID < 0) {
      //we're in group
      await ctx.reply(`где живёшь ферзь (шли локацию)`);
    }
  } catch (error) {
    console.log("error:", error);
    ctx.reply(`ошибка ёба`);
  }
});

//ask for user location
jisaoBot.command("updatelocation", async (ctx) => {
  try {
    let userID = ctx.from.id;
    let chatID = ctx.chat.id;
    const checkUserExist = localStorage.getItem(`${userID}`);
    if (!checkUserExist) {
      console.log(
        `command->updatelocation: user ${userID} doesn't exist, `
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

    //first check if updatehomelocation then if user asked to update
    if (chatData.locationUpdateRequested) {
      chatData.locationUpdateRequested = false;
      chatData.location.latitude = latitude;
      chatData.location.longitude = longitude;
      console.log(`jisaoBot.on(message("location"): ${latitude}, ${longitude}`);
      const { locationID, locationName } = await getLocationDescription(
        latitude,
        longitude
      );
      chatData.locationName = locationName;
      chatData.locationID = locationID;

      localStorage.setItem(
        `${chatData.userID}`,
        JSON.stringify(chatData, null, 2)
      );
      await ctx.reply(`гнездо теперь в ${chatData.locationName}`);
    } else {
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
          //await ctx.reply(`user ${userData.userID} exists, updating location`);
          userData.location.latitude = latitude;
          userData.location.longitude = longitude;
          userData.locationUpdateRequested = false;

          const { locationID, locationName } = await getLocationDescription(
            latitude,
            longitude
          );
          userData.locationName = locationName;
          userData.locationID = locationID;

          localStorage.setItem(`${userID}`, JSON.stringify(userData, null, 2));
          await ctx.reply(`попався в ${userData.locationName}`);
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
    }
  } catch (err) {
    console.log(err);
    await ctx.reply("ошибка ёба");
  }
});

//reacts on text
jisaoBot.on(message(`text`), async (ctx) => {
  if (ctx.text == "=") {
    let arr = new Array(24).fill(0);
    const data = { minutes: [], uv: [], precipIntensity: [] };
    data.precipIntensity = arr.reduce((acc, item, ind) => {
      acc.push(Math.random());
      data.minutes.push(ind);
      data.uv.push(Math.round(Math.random() * 12));
      return acc;
    }, []);
    await getDayChart("chart-day.png", data);
    const chartFilename = `../temp-images/chart-day.png`;

    fs.access(chartFilename, fs.constants.F_OK, async (err) => {
      if (err) {
        console.error(`${filePath} does not exist`);
        ctx.reply(`график тогось`);
      } else {
        await ctx.replyWithPhoto({ source: chartFilename });
      }
    });
  }
});

//---------------CRON-----------------
//------------------------------------
cron.schedule(
  "40 6 * * *", //6.40 every day
  async () => {
    console.log("Scheduling weather post...");
    await jisaoBot.telegram.sendMessage(homeChatId, `доброго здоровичка`);
    await postToBotWeather("today", null, homeChatId);
  },
  { timezone: "Europe/Lisbon" }
);
cron.schedule(
  "15 22 * * *", //22.15 every day
  async () => {
    console.log("Scheduling weather post...");
    await postToBotWeather("tomorrow", null, homeChatId);
    await jisaoBot.telegram.sendMessage(homeChatId, `спокедулечки`);
  },
  { timezone: "Europe/Lisbon" }
);

//---------------LAUNCH-----------------
//--------------------------------------
jisaoBot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
