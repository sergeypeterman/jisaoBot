const { getLimits } = require('./api-limits');

function getMinuteDescription(userData, minuteReply) {
  let forecast2hr;
  const limits = getLimits();
  if (minuteReply.error.status) {
    return `ошибка:\n${minuteReply.error.description}`;
  }
  if (minuteReply.forecast12hr.length === 0) {
    console.log(`getMinuteDescription: forecast12hr is empty`);
    forecast2hr = `прогноз не дали, `;
    forecast2hr += limits.limitCore.limitRemain
      ? `лимит общих запросов ${limits.limitCore.limitRemain}/${limits.limitCore.limitTotal}`
      : `лимит общих запросов тогось, будем плотить?`;
    forecast2hr += minuteReply.error.status
      ? `ошибка:\n${minuteReply.error.description}`
      : "";
  } else {
    const hour1 = minuteReply.forecast12hr[0];
    const hour2 = minuteReply.forecast12hr[1];

    let precipString = "подробностей не дали";
    /* if (minuteReply.minuteSummary.length > 0) {
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
    } */

    precipString = minuteReply.precipAccuArr.join("");

    //emoji line ${precipString}\n is replaced with charts
    forecast2hr = `В ${
      userData.locationName
    } ${minuteReply.summaryPrecipitation.toLowerCase()}\n\n`;
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
    //forecast2hr += `\n\n||limit: ${limits.limitMinute.limitRemain}/${limits.limitMinute.limitTotal}||`;
  }
  return forecast2hr;
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

/**
 * @param {*} forecast - weather.forecast.forecastday[dayToPost]
 * @returns - prepared forecast.day with modified UV
 */
function prepareForecast(forecast) {
  const preparedForecast = forecast;

  const maxUV = forecast.hour.reduce((acc, item) => {
    if (item.uv > acc) {
      acc = item.uv;
    }
    return acc;
  }, 0);

  preparedForecast.day.uv = maxUV;
  console.log(`prepareForecast: maxUV = ${maxUV}`);
  return preparedForecast;
}

module.exports = {
  getMinuteDescription,
  getJisaoDescription,
  getConditionRus,
  prepareForecast,
};
