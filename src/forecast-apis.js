const fs = require("fs");
const { create1hrForecastObject, create24hrForecastObject, JisaoMinute } = require('./types');
const { getLimits, setLimits } = require('./api-limits');
const { getUser, jisaoBot } = require('./user-management');
const { isIterable } = require('./utils');
const { getJisaoDescription, getConditionRus, prepareForecast } = require('./forecast-formatters');
const { getDayChart } = require('./charts');
const config = require('./config');

// Helper function to map Pirate Weather precipType to TypeId format
function mapPiratePrecipType(precipType) {
  if (!precipType || precipType === "none") {
    return 0; // no precipitation
  }
  switch (precipType.toLowerCase()) {
    case "rain":
      return 1;
    case "snow":
      return 2;
    case "sleet":
      return 3;
    default:
      return 0;
  }
}

async function getForecast1hr(userID) {
  const jisaoMinute = {
    summaryPrecipitation: "",
    minuteSummary: [],
    forecast12hr: [],
    error: { status: false, description: "" },
  };

  const limits = getLimits();

  const isLimitPirateReached =
    limits.limitPirate.limitRemain == 0 ? true : false;

  let userData = getUser(userID);

  if (!userData) {
    jisaoMinute.summaryPrecipitation = `user ${userID} doesn't exist`;
    return jisaoMinute;
  }

  try {
    //getting minutecast from pirate weather (1hr = 60 minutes instead of accuweather's 2hr = 120 minutes)
    //console.log(userData);

    if (isLimitPirateReached) {
      jisaoMinute.summaryPrecipitation = `лимит пиратских запросов тогось, будем плотить?`;
      setLimits(limits);
      return jisaoMinute;
    } else {
      const pirateQuery = `https://api.pirateweather.net/forecast/${config.pirateWeatherKey}/${userData.location.latitude},${userData.location.longitude}?units=si&exclude=[daily,alerts]`;
      console.log(
        `getForecast1hr: fetching PirateWeather forecast, limitPirate: ${limits.limitPirate.limitRemain}/${limits.limitPirate.limitTotal}`
      );
      const pirateResp = await fetch(pirateQuery);
      const pirateData = await pirateResp.json();

      limits.limitPirate.limitTotal = pirateResp.headers.get("RateLimit-Limit");
      limits.limitPirate.limitRemain = pirateResp.headers.get(
        "RateLimit-Remaining"
      );
      console.log(
        `getForecast1hr: PirateWeather limit: ${limits.limitPirate.limitRemain}/${limits.limitPirate.limitTotal}`
      );

      // Process minutely data (60 minutes)
      if (pirateData.minutely && pirateData.minutely.summary) {
        jisaoMinute.summaryPrecipitation = pirateData.minutely.summary;
        
        if (pirateData.minutely.data && pirateData.minutely.data.length > 0) {
          // Create minuteSummary array similar to AccuWeather format
          // Group consecutive minutes with same precipType
          let currentType = mapPiratePrecipType(pirateData.minutely.data[0].precipType);
          let startMinute = 0;
          
          for (let i = 1; i < pirateData.minutely.data.length; i++) {
            const type = mapPiratePrecipType(pirateData.minutely.data[i].precipType);
            if (type !== currentType) {
              jisaoMinute.minuteSummary.push({
                startMinute: startMinute,
                type: currentType,
              });
              currentType = type;
              startMinute = i;
            }
          }
          // Add the last segment
          jisaoMinute.minuteSummary.push({
            startMinute: startMinute,
            type: currentType,
          });

          // Create precipArr with 60 items (1 hour instead of 120)
          // Fill array with precipitation types based on minuteSummary
          if (jisaoMinute.minuteSummary.length > 0) {
            let precipArr = Array(60).fill(jisaoMinute.minuteSummary[0].type);
            
            for (let i = 1; i < jisaoMinute.minuteSummary.length; i++) {
              let minutesNext = jisaoMinute.minuteSummary[i].startMinute;
              for (let j = minutesNext; j < precipArr.length; j++) {
                precipArr[j] = jisaoMinute.minuteSummary[i].type;
              }
            }
            jisaoMinute.precipAccuArr = precipArr;
          }
        }
      } else {
        // Minutely data might not always be available, set a default summary
        jisaoMinute.summaryPrecipitation = "минутный прогноз недоступен";
      }

      // Process hourly data (12 hours)
      if (!pirateData.hourly || !pirateData.hourly.data) {
        throw new Error(
          `hourly data is not present in pirateResp\n${JSON.stringify(
            pirateData,
            null,
            2
          )}`
        );
      }

      const hourlyData = pirateData.hourly.data.slice(0, 12); // Get first 12 hours

      if (!isIterable(hourlyData)) {
        throw new Error(
          `hourlyData is not iterable, its value is:\n${JSON.stringify(
            hourlyData,
            null,
            2
          )}`
        );
      }

      for (const hour of hourlyData) {
        // Pirate Weather uses m/s for wind speed (SI units)
        // Temperature is in Celsius, humidity is 0-1 (needs conversion to percentage), precipProbability is 0-1
        // precipIntensity is mm/h, which represents accumulation for 1 hour
        const hrForecast = create1hrForecastObject(
          hour.temperature,
          hour.apparentTemperature,
          Math.round(hour.windSpeed * 10) / 10, // Already in m/s
          hour.windGust ? Math.round(hour.windGust * 10) / 10 : Math.round(hour.windSpeed * 10) / 10,
          Math.round(hour.humidity * 100), // Convert from 0-1 to percentage (0-100)
          hour.precipIntensity || 0, // mm/h, represents accumulation for 1 hour
          Math.round(hour.precipProbability * 100) // Convert from 0-1 to percentage (0-100)
        );
        jisaoMinute.forecast12hr.push(hrForecast);
      }
    }
    setLimits(limits);
    //console.log(JSON.stringify({limitPirate: limits.limitPirate},null,2));
  } catch (err) {
    jisaoMinute.error.status = true;
    jisaoMinute.error.description = err;
    console.log(`'getForecast1hr err: '+${config.stars}`);
    console.log(`'getForecast1hr err: '+\n${err}`);
  }
  return jisaoMinute;
}

// function is being used for daily forecasts at home only (yeah, not the best name)
async function postToBotWeather(day, ctx = null, targetchat = config.chatIdBot) {
  try {
    //getting home data
    let homeUser = getUser(config.homeChatId);

    //changed hardcoded location
    let queryBase = `http://api.weatherapi.com/v1/forecast.json?key=${config.weatherKey}`;
    let query2days =
      queryBase + `&q=${homeUser.locationName}&days=2&aqi=no&alerts=yes`;

    const weatherResponse = await fetch(query2days);
    const condResponse = await fetch(
      "https://www.weatherapi.com/docs/conditions.json"
    );
    const weather = await weatherResponse.json();
    const conditionResponse = await condResponse.json();

    const getCondition = getConditionRus(weather.current, conditionResponse);
    const currentCondition =
      getCondition === undefined ? null : `, ${getCondition}`;

    let dayToPost = day === "today" ? 0 : 1;
    const theDayRus =
      day === "today" ? "сегодня ожидаются" : "завтра обещаются";
    const theDateTdoay = new Date();
    const theDate = new Date(
      theDateTdoay.getFullYear(),
      theDateTdoay.getMonth(),
      theDateTdoay.getDate(),
      0,
      0,
      0,
      0
    );
    day !== "today" && theDate.setDate(theDate.getDate() + 1);
    const unixTime = Math.floor(theDate.getTime() / 1000);
    console.log(unixTime);

    const forecast = prepareForecast(weather.forecast.forecastday[dayToPost]);
    const jisao = getJisaoDescription(forecast.day, conditionResponse);

    const limits = getLimits();

    const isLimitPirateReached =
      limits.limitPirate.limitRemain == 0 ? true : false;

    //units = si, query gets 24hr of data. For 168hrs ?extend=true

    //getting pirate weather. For today use 0h00, for tomorrow

    let pirate24hr = { uv: [] };

    if (isLimitPirateReached) {
      //jisaoMinute.error.description = `лимит пиратских запросов тогось, будем плотить?`;
      //jisaoMinute.error.status = true;
      throw new Error("лимит пиратских запросов тогось, будем плотить?");
    } else {
      let timeQuery = day === "today" ? `,${unixTime}` : "";

      const pirateQuery = `https://api.pirateweather.net/forecast/${config.pirateWeatherKey}/${homeUser.location.latitude},${homeUser.location.longitude}${timeQuery}?units=si&exclude=[daily,alerts]`;
      console.log(`postToBotWeather: ${pirateQuery}`);
      const pirateRes = await fetch(pirateQuery);
      const pirateResponse = await pirateRes.json();

      limits.limitPirate.limitTotal = pirateRes.headers.get("RateLimit-Limit");
      limits.limitPirate.limitRemain = pirateRes.headers.get(
        "RateLimit-Remaining"
      );
      console.log(
        `getPirateForecast2hr: PirateWeather limit: ${limits.limitPirate.limitRemain}/${limits.limitPirate.limitTotal}`
      );

      setLimits(limits);

      for (let i = 0; i < pirateResponse.hourly.data.length; i++) {
        //let firstHourIndex = i;
        if (pirateResponse.hourly.data[i].time == unixTime) {
          for (let j = i; j < 24; j++) {
            pirate24hr.uv.push(pirateResponse.hourly.data[j].uvIndex);
          }
          console.log(pirate24hr.uv);
          break;
        }
      }
    }

    //filling data for 24hr chart
    const weather24hr = create24hrForecastObject();
    for (let i = 0; i < forecast.hour.length; i++) {
      let cur = forecast.hour[i];
      weather24hr.temperature.push(cur.temp_c);
      weather24hr.realfeel.push(cur.feelslike_c);
      weather24hr.wind.push(Math.round((cur.wind_kph * 10) / 3.6) / 10);
      weather24hr.windgust.push(Math.round((cur.gust_kph * 10) / 3.6) / 10);
      weather24hr.humid.push(cur.humidity);
      weather24hr.rain.push(cur.precip_mm);
      weather24hr.rainChance.push(cur.chance_of_rain);
      //weather24hr.uv.push(cur.uv);
      weather24hr.uv.push(pirate24hr.uv[i]);
      weather24hr.num.push((i + 1) % 24);
    }
    const chartFilename = "chart-day.png";
    await getDayChart(chartFilename, weather24hr);
    //console.log(JSON.stringify(weather24hr, null, 2));

    let stringPost = `Кстати, погодки в ${weather.location.name} ${theDayRus} ${jisao.whole}`;
    stringPost += `, ${jisao.condition}\n`;
    stringPost += `\n☀️ ${jisao.day},\n🌙 ${jisao.night},\n\n`;
    stringPost += `💦 ${jisao.rain},\n`;
    stringPost += `😎 ${jisao.uv}`;
    stringPost += `\n\nсейчас ${weather.current.temp_c}°C${currentCondition}`;

    //stringPost += await getMIDPassports();
    //fullfilled its purpose

    fs.access(
      `../temp-images/${chartFilename}`,
      fs.constants.F_OK,
      async (err) => {
        if (err) {
          console.error(`../temp-images/${chartFilename} does not exist`);
          ctx.reply(`график тогось`);
        } else {
          if (ctx === null) {
            await jisaoBot.telegram.sendPhoto(
              targetchat,
              {
                source: `../temp-images/${chartFilename}`,
              },
              {
                caption: stringPost,
                parse_mode: "Markdown",
              }
            );
          } else if (ctx) {
            await ctx.replyWithPhoto(
              { source: `../temp-images/${chartFilename}` },
              { caption: stringPost, parse_mode: "Markdown" }
            );
          } else {
            throw new Error("error, context ctx doesn't exist");
          }
        }
      }
    );
  } catch (err) {
    console.log("error:", err);
    jisaoBot.telegram.sendMessage(config.chatIdBot, err);
  }
}

//possible exclusion:
//['currently', 'minutely', 'hourly', 'daily', 'alerts']
async function getPirateForecast2hr(userID) {
  const userData = getUser(userID);

  const jisaoMinute = new JisaoMinute();

  if (!userData) {
    jisaoMinute.error.description = `user ${userID} doesn't exist`;
    jisaoMinute.error.status = true;
    return jisaoMinute;
  }

  const limits = getLimits();

  const isLimitPirateReached =
    limits.limitPirate.limitRemain == 0 ? true : false;

  //units = si, query gets 24hr of data. For 168hrs ?extend=true
  let data = { precipIntensity60: [], precipProbability60: [], minutes: [] };
  try {
    if (isLimitPirateReached) {
      jisaoMinute.error.description = `лимит пиратских запросов тогось, будем плотить?`;
      jisaoMinute.error.status = true;
    } else {

      const pirateQuery = `https://api.pirateweather.net/forecast/${config.pirateWeatherKey}/${userData.location.latitude},${userData.location.longitude}?units=si&exclude=[daily,alerts]`;
      const res = await fetch(pirateQuery);
      const response = await res.json();

      limits.limitPirate.limitTotal = res.headers.get("RateLimit-Limit");
      limits.limitPirate.limitRemain = res.headers.get("RateLimit-Remaining");
      console.log(
        `getPirateForecast2hr: PirateWeather limit: ${limits.limitPirate.limitRemain}/${limits.limitPirate.limitTotal}`
      );

      setLimits(limits);

      //jisaoMinute.summaryPrecipitation = response.minutely.summary;
      data = response.minutely.data.reduce(
        (acc, item, ind) => {
          acc.precipIntensity60.push(item.precipIntensity);
          acc.precipProbability60.push(item.precipProbability);
          acc.precipType60.push(item.precipType); //rain, snow or sleet; otherwise none
          acc.minutes.push(ind);
          return acc;
        },
        {
          precipIntensity60: [],
          precipProbability60: [],
          minutes: [],
          precipType60: [],
        }
      );
      //console.log(JSON.stringify(data));

      jisaoMinute.precipIntensity = data.precipIntensity60;
      jisaoMinute.precipType = data.precipType60;

      jisaoMinute.averagePrecip =
        data.precipIntensity60.reduce((acc, item) => (acc += item), 0) /
        data.precipIntensity60.length;
    }
  } catch (err) {
    console.log(err);
  }

  return jisaoMinute;
}

/**
 * Processes weather1hr forecast data - gets forecasts, processes precipitation data, and prepares chart data
 * @param {number} userID - User ID
 * @returns {Promise<{chartData: Object, forecastText: string, minuteReply: Object, userData: Object}>}
 */
async function processWeather1hrData(userID) {
  const minuteReply = await getForecast1hr(userID);
  if (minuteReply.error.status) {
    throw new Error(minuteReply.error.description);
  }

  const { precipIntensity, precipType, averagePrecip } =
    await getPirateForecast2hr(userID);

  minuteReply.precipIntensity = precipIntensity;
  minuteReply.precipType = precipType;
  minuteReply.averagePrecip = averagePrecip;

  let userData = getUser(userID);
  if (!userData) {
    console.log(`weather1hr: user ${userID} doesn't exist`);
    throw new Error(`user ${userID} doesn't exist`);
  } else {
    console.log(
      `weather1hr: requesting forecast for user ${userData.userID}`
    );
  }

  const { getMinuteDescription } = require('./forecast-formatters');
  let forecastText = getMinuteDescription(userData, minuteReply);

  //forging data
  //get 60 min from pirate weather for rain(true\false), and extend 60 min of pirate(mm\hr) with average
  let chartData = { precipIntensity: [], minutes: [] };
  chartData.precipIntensity = minuteReply.precipIntensity;
  chartData.minutes = new Array(60).fill(0).reduce((acc, item, ind) => {
    acc.push(ind);
    if (chartData.precipIntensity[ind] === undefined) {
      chartData.precipIntensity.push(minuteReply.forecast12hr[1].rain);
    }
    return acc;
  }, []);

  console.log(`accuweather: ${minuteReply.precipAccuArr}`);
  console.log(`pirate precipIntensity: ${chartData.precipIntensity}`);
  console.log(
    `forecast12hr[0]: ${JSON.stringify(minuteReply.forecast12hr[0])}`
  );
  console.log(
    `forecast12hr[1]: ${JSON.stringify(minuteReply.forecast12hr[1])}`
  );
  //filtering out pirate weather minute values, based on accuweather 0\1\..
  for (let i = 0; i < chartData.precipIntensity.length; i++) {
    if (minuteReply.precipAccuArr[i]) {
      if (chartData.precipIntensity[i] === 0) {
        let hour = Math.floor(i / 60);
        console.log(`hour: ${hour}`);
        if (!minuteReply.forecast12hr[hour].rain) {
          chartData.precipIntensity[i] = minuteReply.averagePrecip;
        } else {
          chartData.precipIntensity[i] = minuteReply.forecast12hr[hour].rain;
        }
      }
    } else {
      chartData.precipIntensity[i] = 0;
    }
  }
  console.log(`finally: ${chartData.precipIntensity}`);

  return {
    chartData,
    forecastText,
    minuteReply,
    userData,
  };
}

module.exports = {
  getForecast1hr,
  getPirateForecast2hr,
  postToBotWeather,
  processWeather1hrData,
};
