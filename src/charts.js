const fs = require("fs");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const sharp = require("sharp");

async function getDayChart(filename, inputData = {}) {
  const width = 900; //px
  const height = 300; //px
  const backgroundColour = "white"; // Uses https://www.w3schools.com/tags/canvas_fillstyle.asp

  const canvas300900 = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour,
  });

  const colors = {
    uv: "rgb(228, 102, 8)",
    uvBack: "#FF450030",
    precip: "rgb(134, 162, 214)",
    darkPrecip: "rgb(102, 123, 163)",
    temperatureFill: "#ff918040",
    temperature: "#b31800",
    darkPrecipChance: "rgba(102, 123, 163, 0.5)",
    humidity: "#4e548f",
  };
  const dataSun = {
    labels: inputData.num,
    datasets: [
      {
        type: "line",
        label: "",
        data: inputData.uv,
        borderWidth: 0.5,
        borderColor: colors.uv,
        backgroundColor: colors.uvBack,
        tension: 0.5,
        pointRadius: 0,
        yAxisID: "yr",
      },
      {
        type: "line",
        label: "",
        data: inputData.temperature,
        borderColor: colors.temperature,
        backgroundColor: colors.temperatureFill,
        tension: 0.1,
        pointRadius: 0,
        yAxisID: "yl",
      },
      {
        type: "line",
        label: "",
        data: inputData.realfeel,
        borderWidth: 1,
        borderColor: colors.temperature,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        yAxisID: "yl",
      },
    ],
  };

  const configurationSun = {
    data: dataSun,
    options: {
      scales: {
        yr: {
          title: {
            display: true,
            text: "UV",
            color: colors.uv,
            padding: 10,
          },
          suggestedMin: 0,
          suggestedMax: 12,
          position: "right",
        },
        yl: {
          title: {
            display: true,
            text: "Температура",
            color: colors.temperature,
          },
          suggestedMin: 0,
          suggestedMax: 30,
          position: "left",
        },
      },
      plugins: {
        title: { display: true, text: "СИЛА СОЛНЦА" },
        legend: { display: false },
      },
      fill: true,
    },
    plugins: [],
  };

  const dataWater = {
    labels: inputData.num,
    datasets: [
      {
        type: "line",
        label: "Влажность",
        data: inputData.humid,
        fill: false,
        borderWidth: 3,
        borderColor: colors.humidity,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: "yr",
      },
      {
        type: "line",
        label: "Вероятность",
        data: inputData.rainChance,
        fill: false,
        borderWidth: 1,
        borderColor: colors.darkPrecipChance,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: "yr",
      },
      {
        type: "line",
        label: "Количество",
        data: inputData.rain,
        backgroundColor: colors.precip,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: "yl",
      },
    ],
  };

  const configurationWater = {
    data: dataWater,
    options: {
      scales: {
        yr: {
          title: {
            display: true,
            text: "%",
            color: colors.darkPrecip,
          },
          suggestedMin: 0,
          suggestedMax: 100,
          position: "right",
        },
        yl: {
          title: {
            display: true,
            text: "Осадки, мм/час",
            color: colors.precip,
          },
          suggestedMin: 0,
          suggestedMax: 1,
          position: "left",
        },
      },
      plugins: {
        title: { display: true, text: "СИЛА ВОДЫ" },
        legend: { display: true, labels: { boxHeight: 3 } },
      },
      fill: true,
    },
    plugins: [],
  };

  const sunImage = await canvas300900.renderToBuffer(configurationSun);
  const waterImage = await canvas300900.renderToBuffer(configurationWater);

  const directory = "../temp-images"; // Specify the directory where you want to save the file
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }
  //fs.writeFileSync(`${directory}/0${filename}`, image);

  const combinedImage = sharp({
    create: {
      width: 900,
      height: 600,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 4 }, // Transparent background
    },
  });

  await combinedImage.composite([
    { input: sunImage, top: 0, left: 4 },
    { input: waterImage, top: 300, left: 0 },
  ]);
  await combinedImage.png().toFile(`${directory}/${filename}`);

  return true;
}

async function getMinuteChart(filename, inputData = {}) {
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
        data: inputData.precipIntensity,

        backgroundColor: "rgb(134, 162, 214)",
        tension: 0.1,
        pointRadius: 0,
      },
      /* {
        type: "line",
        label: "% вероятность",
        data: inputData.precipProbability60,
        fill: false,
        borderColor: "rgb(102, 123, 163)",
        tension: 0.1,
        pointRadius: 0,
      }, */
    ],
  };

  const configuration = {
    data: data,
    options: {
      scales: { y: { suggestedMin: 0, suggestedMax: 1 } },
      plugins: {
        title: { display: true, text: "СИЛА ВОДЫ" },
      },
      fill: true,
    },
    plugins: [],
  };
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);

  const directory = "../temp-images"; // Specify the directory where you want to save the file
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }
  fs.writeFileSync(`${directory}/${filename}`, image);

  return true;
}

module.exports = {
  getMinuteChart,
  getDayChart,
};