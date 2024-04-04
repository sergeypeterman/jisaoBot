require("dotenv").config();
const fs = require("fs");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const { title } = require("process");
module.exports = {
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
  getPirateForecast2hr,
};
const stars = `\n*****************************\n`;
const chatIdBot = process.env.BOT_ID; //chat-id of my chat with bot
const weatherKey = process.env.WEATHERAPI_KEY;
const accuweatherKey = process.env.ACCUWEATHER_CORE_KEY;
const accuweatherMinuteKey = process.env.ACCUWEATHER_MINUTE_KEY;
const pirateWeatherKey = process.env.P_WEATHER_KEY;

let jisaoBot;
function setBotObject(botObject) {
  jisaoBot = botObject;
}

async function createUser(
  userID,
  location = { latitude: 38.686116, longitude: -9.349137 }
) {
  const newUser = {
    userID: userID,
    location: location,
    locationUpdateRequested: false,
    locationID: 0,
    locationName: "",
  };

  const checkUserExist = localStorage.getItem(`${userID}`);
  if (checkUserExist) {
    const existingUser = JSON.parse(checkUserExist);
    if (existingUser.location.latitude === newUser.location.latitude) {
      if (existingUser.location.longitude === newUser.location.longitude) {
        console.log(
          `user ${userID} already exists and located in ${existingUser.locationName}`
        );
        return existingUser;
      }
    }
  }

  try {
    console.log("createUser(): getting location name and ID");
    let query = `http://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${accuweatherKey}`;
    query += `&q=${newUser.location.latitude},${newUser.location.longitude}`;
    const response = await fetch(query);
    const geopositionRes = await response.json();
    newUser.locationID = geopositionRes.Key;

    queryName = `http://api.weatherapi.com/v1/forecast.json?key=${weatherKey}&q=${newUser.location.latitude},${newUser.location.longitude}&days=1&aqi=no&alerts=no`;
    const responseName = await fetch(queryName);
    const geopositionNameRes = await responseName.json();
    newUser.locationName = geopositionNameRes.location.name;

    const locationJson = JSON.stringify(newUser, null, 2);
    localStorage.setItem(`${userID}`, locationJson);
  } catch (err) {
    console.log(err);
  }
  return await newUser;
}

function create1hrForecastObject(
  temperature = 0,
  realfeel = 0,
  wind = 0,
  windgust = 0,
  humid = 0,
  rain = 0,
  rainChance = 0
) {
  const forecast1hr = {
    temperature: temperature,
    realfeel: realfeel,
    wind: wind,
    windgust: windgust,
    humid: humid,
    rain: rain,
    rainChance: rainChance,
  };

  return forecast1hr;
}

function getMinuteDescription(userData, minuteReply) {
  let forecast2hr;
  if (minuteReply.error.status) {
    return `ошибка:\n${minuteReply.error.description}`;
  }
  if (minuteReply.forecast12hr.length === 0) {
    console.log(`getMinuteDescription: forecast12hr is empty`);
    forecast2hr = `прогноз не дали, `;
    forecast2hr += minuteReply.limitCore.limitRemain
      ? `лимит общих запросов ${minuteReply.limitCore.limitRemain}/${minuteReply.limitCore.limitTotal}`
      : `лимит общих запросов тогось, будем плотить?`;
    forecast2hr += minuteReply.error.status
      ? `ошибка:\n${minuteReply.error.description}`
      : "";
  } else {
    const hour1 = minuteReply.forecast12hr[0];
    const hour2 = minuteReply.forecast12hr[1];

    let precipString = "подробностей не дали";
    if (minuteReply.minuteSummary.length > 0) {
      let precipArr = Array(12).fill(minuteReply.minuteSummary[0].type);

      //filling 10-minutes blocks with precipitation types
      for (let i = 1; i < minuteReply.minuteSummary.length; i++) {
        let minutes10 = Math.floor(
          minuteReply.minuteSummary[i].startMinute / 10
        );
        for (let j = minutes10; j < precipArr.length; j++) {
          precipArr[j] = minuteReply.minuteSummary[i].type;
        }
      }
      precipString = precipArr.join("");
    }

    forecast2hr = `В ${
      userData.locationName
    } ${minuteReply.summaryPrecipitation.toLowerCase()}\n${precipString}\n\n`;
    forecast2hr += `В этом часу\n🌡️ ${hour1.temperature}°C, ощущается как ${hour1.realfeel}°C\n`;
    forecast2hr += `💨 ветер ${hour1.wind}м/с c порывами до ${hour1.windgust}м/с`;
    forecast2hr +=
      hour1.rain > 0
        ? `\n☔ ${hour1.rain}мм осадков с вероятностью ${hour1.rainChance}%`
        : "";
    forecast2hr += `\n\nВ следующем часу\n🌡️ ${hour2.temperature}°C, ощущается как ${hour2.realfeel}°C\n`;
    forecast2hr += `💨 ветер ${hour2.wind}м/с c порывами до ${hour2.windgust}м/с\n`;
    forecast2hr +=
      hour2.rain > 0
        ? `☔ ${hour2.rain}мм осадков с вероятностью ${hour2.rainChance}%`
        : "";
    //forecast2hr += `\n\n||limit: ${minuteReply.limitMinute.limitRemain}/${minuteReply.limitMinute.limitTotal}||`;
  }
  return forecast2hr;
}

function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === "function";
}

function getMinuteEmoji(id) {
  switch (id) {
    case null:
      return "🌂";
    case 0:
      return "🌂";
    case 1:
      return "💧";
    case 3:
      return "🧊";
    case 2:
      return "❄️";
    case 6:
      return "☔";
    case 18:
      return "⛈️";
    case 35:
      return "💦";
  }
}

function getUser(userID) {
  let userData;

  if (!localStorage.getItem(`${userID}`)) {
    console.log(`user ${userID} doesn't exist`);
    return null;
  } else {
    userData = JSON.parse(localStorage.getItem(`${userID}`));
    //console.log(`getForecast2hr: user exists ${JSON.stringify(userData, null, 2)}`);
  }
  return userData;
}

async function getForecast2hr(userID) {
  const jisaoMinute = {
    summaryPrecipitation: "",
    minuteSummary: [],
    forecast12hr: [],
    limitMinute: { limitTotal: 25, limitRemain: 25 },
    limitCore: { limitTotal: 50, limitRemain: 50 },
    error: { status: false, description: "" },
  };

  const localLimits = JSON.parse(localStorage.getItem("limits"));
  if (localLimits) {
    jisaoMinute.limitMinute = localLimits.limitMinute;
    jisaoMinute.limitCore = localLimits.limitCore;
  }
  //console.log("getForecast2hr: " + JSON.stringify(localLimits, null, 2));
  //console.log("getForecast2hr: " + JSON.stringify(jisaoMinute, null, 2));
  const isLimitCoreReached =
    jisaoMinute.limitCore.limitRemain == 0 ? true : false;
  const isLimitMinuteReached =
    jisaoMinute.limitMinute.limitRemain == 0 ? true : false;

  let userData = getUser(userID);

  if (!userData) {
    jisaoMinute.summaryPrecipitation = `user ${userID} doesn't exist`;
    return jisaoMinute;
  }

  try {
    //getting minutecast from accuweather. Later draw a line with symbols be 10 mins. --RRRR----RR
    //console.log(userData);

    if (isLimitMinuteReached) {
      jisaoMinute.summaryPrecipitation = `лимит минутных запросов тогось, будем плотить?`;
    } else {
      let queryMinute = `http://dataservice.accuweather.com/forecasts/v1/minute?q=`;
      queryMinute += `${userData.location.latitude},${userData.location.longitude}&apikey=${accuweatherMinuteKey}&&language=ru-ru`;
      const accuResp = await fetch(queryMinute);
      const forecastMinute = await accuResp.json();

      jisaoMinute.limitMinute.limitTotal =
        accuResp.headers.get("ratelimit-limit");
      jisaoMinute.limitMinute.limitRemain = accuResp.headers.get(
        "ratelimit-remaining"
      );
      console.log(
        `getForecast2hr: accuweather MinuteCast limit: ${jisaoMinute.limitMinute.limitRemain}/${jisaoMinute.limitMinute.limitTotal}`
      );

      if (forecastMinute.Summary.Phrase) {
        jisaoMinute.summaryPrecipitation = forecastMinute.Summary.Phrase;
        if (forecastMinute.Summaries.length > 0) {
          for (let sum of forecastMinute.Summaries) {
            const type = getMinuteEmoji(sum.TypeId);
            jisaoMinute.minuteSummary.push({
              startMinute: sum.StartMinute,
              type: type,
            });
          }
        }
      } else {
        jisaoMinute.error.status = true;
        jisaoMinute.error.description = `Summary.Phrase isn't present in accuResp\n${JSON.stringify(
          accuResp
        )}`;
        throw new Error(jisaoMinute.error.description);
      }
    }
    //----------12 hr------------
    if (isLimitCoreReached) {
      return jisaoMinute;
    }
    let query12hr = `http://dataservice.accuweather.com/forecasts/v1/hourly/12hour/`;
    query12hr += `${userData.locationID}?apikey=${accuweatherKey}&language=ru-ru&details=true&metric=true`;
    console.log(
      `fetching 12hr forecast, limitCore: ${jisaoMinute.limitCore.limitRemain}/${jisaoMinute.limitCore.limitTotal}`
    );
    const accu12Resp = await fetch(query12hr);
    const forecast12hr = await accu12Resp.json();
    jisaoMinute.limitCore.limitTotal =
      accu12Resp.headers.get("ratelimit-limit");
    jisaoMinute.limitCore.limitRemain = accu12Resp.headers.get(
      "ratelimit-remaining"
    );

    if (!isIterable(forecast12hr)) {
      throw new Error(
        `forecast12hr is not iterable, its value is:\n${JSON.stringify(
          forecast12hr,
          null,
          2
        )}`
      );
    }

    for (const hour of forecast12hr) {
      //console.log(hour.Temperature.Value);
      const hrForecast = create1hrForecastObject(
        hour.Temperature.Value,
        hour.RealFeelTemperatureShade.Value,
        Math.round((hour.Wind.Speed.Value * 10) / 3.6) / 10,
        Math.round((hour.WindGust.Speed.Value * 10) / 3.6) / 10,
        hour.RelativeHumidity,
        hour.TotalLiquid.Value,
        hour.RainProbability
      );
      jisaoMinute.forecast12hr.push(hrForecast);
    }
    localStorage.setItem(
      `limits`,
      JSON.stringify(
        {
          limitMinute: jisaoMinute.limitMinute,
          limitCore: jisaoMinute.limitCore,
        },
        null,
        2
      )
    );
    //console.log(JSON.stringify({limitMinute: jisaoMinute.limitMinute,limitCore: jisaoMinute.limitCore,},null,2));
  } catch (err) {
    jisaoMinute.error.status = true;
    jisaoMinute.error.description = err;
    console.log(`'getForecast2hr err: '+${stars}`);
    console.log(`'getForecast2hr err: '+\n${err}`);
  }
  return jisaoMinute;
}

async function postToBotWeather(day, ctx = null, targetchat = chatIdBot) {
  try {
    let queryBase = `http://api.weatherapi.com/v1/forecast.json?key=${weatherKey}`;
    let query2days = queryBase + `&q=Parede&days=2&aqi=no&alerts=yes`;

    const weatherResponse = await fetch(query2days);

    /* let test = weatherResponse.headers.get(`date`);
    console.log(weatherResponse.headers)
    console.log(`test headers ${test}`); */
    const weather = await weatherResponse.json();
    const condResponse = await fetch(
      "https://www.weatherapi.com/docs/conditions.json"
    );
    const conditionResponse = await condResponse.json();

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

//weather for next 120 mins, Accuweater

//unversal function, maybe it's excessive
async function getForecast(provider = "accuweather") {}

//add 0 to a 2-digit num (hours and minutes)
function leadingZero(num) {
  let withZero = "";

  withZero = "0" + num;

  return withZero.slice(-2);
}

//describe jisao, returns object with ready to post description
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

async function getChart(filename, inputData = {}) {
  const width = 800; //px
  const height = 400; //px
  const backgroundColour = "white"; // Uses https://www.w3schools.com/tags/canvas_fillstyle.asp
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });
  const data = {
    labels: inputData.minutes,
    datasets: [
      {
        type: "line",
        label: "мм/ч",
        data: inputData.precipIntensity60,
        fill: {
          target: "origin",
          above: "rgb(134, 162, 214)", // Area will be red above the origin
        },
        //borderColor: "rgb(102, 123, 163)",
        tension: 0.1,
        pointRadius: 0,
      },
      {
        type: "line",
        label: "% вероятность",
        data: inputData.precipProbability60,
        fill: false,
        borderColor: "rgb(102, 123, 163)",
        tension: 0.1,
        pointRadius: 0,
      },
    ],
  };

  const configuration = {

    data: data,
    options: {
      scales: { y: { suggestedMin: 0, suggestedMax: 1 } },
      plugins: {
        title: { display: true, text: "Я не плачу, это просто дощь" },
      },
    },
    plugins: [],
  };
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);

  const directory = "temp-images"; // Specify the directory where you want to save the file
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }
  fs.writeFileSync(`${directory}/${filename}`, image);

  return true;
}

//possible exclusion:
//['currently', 'minutely', 'hourly', 'daily', 'alerts']
async function getPirateForecast2hr(userID) {
  const userData = getUser(userID);

  const jisaoMinute = {
    summaryPrecipitation: "чот пошло не так",
    minuteSummary: [],
    forecast12hr: [],
    limitPirate: { limitTotal: 10000, limitRemain: 10000 },
    error: { status: false, description: "" },
  };

  if (!userData) {
    jisaoMinute.summaryPrecipitation = `user ${userID} doesn't exist`;
    return jisaoMinute;
  }

  const localLimits = JSON.parse(localStorage.getItem("limits"));
  if (localLimits) {
    jisaoMinute.limitPirate = localLimits.limitPirate;
    jisaoMinute.limitCore = localLimits.limitCore;
    jisaoMinute.limitMinute = localLimits.limitMinute;
  }
  const isLimitPirateReached =
    jisaoMinute.limitPirate.limitRemain == 0 ? true : false;

  //units = si, query gets 24hr of data. For 168hrs ?extend=true
  //unsing munich for tests 48.137154,11.576124
  //${userData.location.latitude},${userData.location.longitude}
  let data = { precipIntensity60: [], precipProbability60: [], minutes: [] };
  try {
    if (isLimitPirateReached) {
      jisaoMinute.summaryPrecipitation = `лимит пиратских запросов тогось, будем плотить?`;
    } else {
      const pirateQuery = `https://api.pirateweather.net/forecast/${pirateWeatherKey}/48.137154,11.576124?units=si&exclude=[daily,alerts]`;
      const res = await fetch(pirateQuery);
      const response = await res.json();

      jisaoMinute.limitPirate.limitTotal = res.headers.get("RateLimit-Limit");
      jisaoMinute.limitPirate.limitRemain = res.headers.get(
        "RateLimit-Remaining"
      );
      console.log(
        `getPirateForecast2hr: PirateWeather limit: ${jisaoMinute.limitPirate.limitRemain}/${jisaoMinute.limitPirate.limitTotal}`
      );

      localStorage.setItem(
        `limits`,
        JSON.stringify(
          {
            limitMinute: jisaoMinute.limitMinute,
            limitCore: jisaoMinute.limitCore,
            limitPirate: jisaoMinute.limitPirate,
          },
          null,
          2
        )
      );

      jisaoMinute.summaryPrecipitation = response.minutely.summary;
      data = response.minutely.data.reduce(
        (acc, item, ind) => {
          acc.precipIntensity60.push(item.precipIntensity);
          acc.precipProbability60.push(item.precipProbability);
          acc.minutes.push(ind);
          return acc;
        },
        { precipIntensity60: [], precipProbability60: [], minutes: [] }
      );
      console.log(JSON.stringify(data));
      await getChart(`chart.png`, data);
    }
  } catch (err) {
    console.log(err);
  }

  return jisaoMinute;
}
