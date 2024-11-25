module.exports = {
  name: "jisao-bot",
  script: "./src/jisao-bot.js",
  // Specify which folder to watch
  watch: ["src"],
  // Specify delay between watch interval
  watch_delay: 1000,
  // Specify which folder to ignore
  ignore_watch: ["node_modules", "scratch", "temp-images"],
};
