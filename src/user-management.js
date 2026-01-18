const config = require('./config');

let jisaoBot;
function setBotObject(botObject) {
  jisaoBot = botObject;
}

//new User datatype instance
async function createUser(
  userID,
  location = { latitude: 38.686116, longitude: -9.349137 } //Parede by default
) {
  const newUser = {
    userID: userID,
    location: location,
    locationUpdateRequested: false,
    locationID: 0,
    locationName: "",
  };
  console.log(`createUser(): looking for user ${userID} in local storage`);

  //checking if user already exists locally and located in the same location
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
    console.log("createUser(): getting location ID and name");
    let query = `http://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${config.accuweatherKey}`;
    query += `&q=${newUser.location.latitude},${newUser.location.longitude}`;
    const response = await fetch(query);
    const geopositionRes = await response.json();
    
    if (!geopositionRes || !geopositionRes.Key) {
      throw new Error(`Invalid response from AccuWeather: ${JSON.stringify(geopositionRes)}`);
    }
    newUser.locationID = geopositionRes.Key;

    const queryName = `http://api.weatherapi.com/v1/forecast.json?key=${config.weatherKey}&q=${newUser.location.latitude},${newUser.location.longitude}&days=1&aqi=no&alerts=no`;
    const responseName = await fetch(queryName);
    const geopositionNameRes = await responseName.json();
    
    if (!geopositionNameRes || !geopositionNameRes.location || !geopositionNameRes.location.name) {
      throw new Error(`Invalid response from WeatherAPI: ${JSON.stringify(geopositionNameRes)}`);
    }
    newUser.locationName = geopositionNameRes.location.name;

    const locationJson = JSON.stringify(newUser, null, 2);
    localStorage.setItem(`${userID}`, locationJson);
  } catch (err) {
    console.error(`Error in createUser for userID ${userID}:`, err);
  }
  return newUser;
}

function getUser(userID) {
  let userData;

  if (!localStorage.getItem(`${userID}`)) {
    console.log(`user ${userID} doesn't exist`);
    return null;
  } else {
    userData = JSON.parse(localStorage.getItem(`${userID}`));
    //console.log(`getForecast1hr: user exists ${JSON.stringify(userData, null, 2)}`);
  }
  return userData;
}

async function getLocationDescription(latitude, longitude) {
  const description = { locationID: null, locationName: null };
  let queryBase = `http://api.weatherapi.com/v1/forecast.json?key=${config.weatherKey}`;
  let queryLocationName =
    queryBase + `&q=${latitude},${longitude}&days=1&aqi=no&alerts=no`;
  const locationResponse = await fetch(queryLocationName);
  const locationObj = await locationResponse.json();
  description.locationName = locationObj.location.name;

  description.locationID = Math.random().toString(36).substring(2, 15);
  return description;
}

module.exports = {
  createUser,
  getUser,
  getLocationDescription,
  setBotObject,
  get jisaoBot() {
    return jisaoBot;
  },
};
