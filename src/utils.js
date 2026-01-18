//add 0 to a 2-digit num (hours and minutes)
function leadingZero(num) {
  let withZero = "";

  withZero = "0" + num;

  return withZero.slice(-2);
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

const numsP = [
  { name: "Гусь", id: "2000351012024091600011972", status: "" },
  { name: "Царь", id: "2000351012024100700012084", status: "" },
];
async function getMIDPassports() {
  const newNums = JSON.parse(JSON.stringify(numsP));

  let mid = `\n`;
  await Promise.all(
    newNums.map(async (item) => {
      const queryMID = `https://info.midpass.ru/api/request/${item.id}`;

      const res = await fetch(queryMID);
      const response = await res.json();

      item.status += `\n${item.name}, `;
      item.status += response.passportStatus.name;
      item.status += `\nГотовность: ${response.internalStatus.percent}%, ${response.internalStatus.name}`;

      mid += item.status;
    })
  );
  console.log(mid);
  return mid;
}

//unversal function, maybe it's excessive
async function getForecast(provider = "accuweather") {}

module.exports = {
  leadingZero,
  isIterable,
  getMinuteEmoji,
  getMIDPassports,
  getForecast,
};
