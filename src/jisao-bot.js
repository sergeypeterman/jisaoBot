const { Telegraf, Markup } = require("telegraf");
const { message } = require("telegraf/filters");
const fs = require("fs");
const cron = require("node-cron");
const {
  createUser,
  create1hrForecastObject,
  getMinuteDescription,
  getForecast1hr,
  postToBotWeather,
  leadingZero,
  getJisaoDescription,
  getConditionRus,
  setBotObject,
  getMinuteChart,
  getPirateForecast2hr,
  getLocationDescription,
  getDayChart,
  processWeather1hrData,
} = require("./jisao-functions");

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Verify the environment variables are loaded
console.log("Environment check:");
// console.log("AccuWeather Key exists:", !!process.env.ACCUWEATHER_CORE_KEY);
console.log("Weather API Key exists:", !!process.env.WEATHERAPI_KEY);
console.log("Pirate Weather Key exists:", !!process.env.P_WEATHER_KEY);

const botKeys = process.env.TG_API_KEY;
const weatherKey = process.env.WEATHERAPI_KEY;
// const accuweatherKey = process.env.ACCUWEATHER_CORE_KEY;
// const accuweatherMinuteKey = process.env.ACCUWEATHER_MINUTE_KEY;

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
  console.log(`jisaoBot.start(): looking for user ${homeChatId} in local storage`);
  const lastUserData = localStorage.getItem(`${homeChatId}`);
  if (lastUserData) {
    userData = JSON.parse(lastUserData);
    if (userData.location) {
      console.log(`user ${homeChatId} already exists and located in ${userData.locationName}`);
      chatData = await createUser(homeChatId, userData.location);
    } else {
      console.log(`user ${homeChatId} already exists but no location set, creating new user`);
      chatData = await createUser(homeChatId);
    }
  } else {
    console.log(`user ${homeChatId} doesn't exist, creating new user`);
    chatData = await createUser(homeChatId);
  }
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
jisaoBot.command("weather1hr_home", async (ctx) => {
  try {
    const { chartData, forecastText, minuteReply } = await processWeather1hrData(chatData.userID);

    if (minuteReply.averagePrecip > -0.02) {
      await getMinuteChart(`minute.png`, chartData);
      const chartFilename = `../temp-images/minute.png`;

      fs.access(chartFilename, fs.constants.F_OK, async (err) => {
        if (err) {
          console.error(`${chartFilename} does not exist`);
          ctx.reply(`график тогось`);
        } else {
          await ctx.replyWithPhoto(
            { source: chartFilename },
            { caption: forecastText }
          );
        }
      });
    }
  } catch (error) {
    console.log("error:", error);
    if (error.message && error.message.includes("doesn't exist")) {
      await ctx.reply(error.message);
    } else {
      ctx.reply(`ошибка ёба`);
    }
  }
});

jisaoBot.command("weather1hr", async (ctx) => {
  try {
    let userID = ctx.from.id;
    const { chartData, forecastText, minuteReply } = await processWeather1hrData(userID);

    if (minuteReply.averagePrecip > -0.02) {
      await getMinuteChart(`minute.png`, chartData);
      const chartFilename = `../temp-images/minute.png`;

      fs.access(chartFilename, fs.constants.F_OK, async (err) => {
        if (err) {
          console.error(`${chartFilename} does not exist`);
          ctx.reply(`график тогось`);
        } else {
          await ctx.replyWithPhoto(
            { source: chartFilename },
            { caption: forecastText }
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
    if (error.message && error.message.includes("doesn't exist")) {
      await ctx.reply(error.message);
    } else {
      ctx.reply(`ошибка ёба`);
    }
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
    await postToBotWeather("today", null, homeChatId, jisaoBot);
  },
  { timezone: "Europe/Lisbon" }
);
cron.schedule(
  "15 22 * * *", //22.15 every day
  async () => {
    console.log("Scheduling weather post...");
    await postToBotWeather("tomorrow", null, homeChatId, jisaoBot);
    await jisaoBot.telegram.sendMessage(homeChatId, `спокедулечки`);
  },
  { timezone: "Europe/Lisbon" }
);

//---------------LAUNCH-----------------
//--------------------------------------
jisaoBot.launch();

// Enable graceful stop
process.once("SIGINT", () => jisaoBot.stop("SIGINT"));
process.once("SIGTERM", () => jisaoBot.stop("SIGTERM"));
