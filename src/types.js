//default api limits
class APILimits {
  constructor(limitMinute = 25, limitCore = 50, limitPirate = 10000) {
    this.limitMinute = { limitTotal: limitMinute, limitRemain: limitMinute };
    this.limitCore = { limitTotal: limitCore, limitRemain: limitCore };
    this.limitPirate = { limitTotal: limitPirate, limitRemain: limitPirate };
  }
}

//datatype for minute forecasts
class JisaoMinute {
  constructor(
    summaryPrecipitation = "",
    isPrecipitation = true,
    minuteSummary = [],
    precipAccuArr = [],
    forecast12hr = [],
    precipIntensity = [],
    precipType = [],
    averagePrecip = 0,
    error = { status: false, description: "" }
  ) {
    this.summaryPrecipitation = summaryPrecipitation;
    this.isPrecipitation = isPrecipitation;
    this.minuteSummary = minuteSummary;
    this.precipAccuArr = precipAccuArr;
    this.forecast12hr = forecast12hr;
    this.precipIntensity = precipIntensity;
    this.precipType = precipType;
    this.averagePrecip = averagePrecip;
    this.error = error;
  }
}

class JisaoDay {
  constructor() {}
}

//datatype for hourly forecasts
function create1hrForecastObject(
  temperature = 0,
  realfeel = 0,
  wind = 0,
  windgust = 0,
  humid = 0,
  rain = 0,
  rainChance = 0,
  uv = 0,
  num = 0
) {
  const forecast1hr = {
    temperature: temperature,
    realfeel: realfeel,
    wind: wind,
    windgust: windgust,
    humid: humid,
    rain: rain,
    rainChance: rainChance,
    uv: uv,
    num: num,
  };

  return forecast1hr;
}

function create24hrForecastObject(
  temperature = [],
  realfeel = [],
  wind = [],
  windgust = [],
  humid = [],
  rain = [],
  rainChance = [],
  uv = [],
  num = []
) {
  const forecast24hr = {
    temperature: temperature,
    realfeel: realfeel,
    wind: wind,
    windgust: windgust,
    humid: humid,
    rain: rain,
    rainChance: rainChance,
    uv: uv,
    num: num,
  };

  return forecast24hr;
}

module.exports = {
  APILimits,
  JisaoMinute,
  JisaoDay,
  create1hrForecastObject,
  create24hrForecastObject,
};
