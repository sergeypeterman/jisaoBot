const { APILimits } = require('./types');
const { getKV, putKV } = require('./db');

//reads limits from the database, or returns a default object if there is none
function getLimits() {
  const limits = new APILimits();

  //writing stored limits to the object
  const localLimits = getKV("limits");
  if (localLimits) {
    Object.keys(limits).map((aLimit) => {
      if (Object.hasOwn(localLimits, aLimit)) {
        limits[aLimit] = localLimits[aLimit];
      } else {
        console.log(
          `getLimits: ${aLimit} is not present on disk, assigning defalt value. Use setLimits to write it`
        );
      }
    });
  } else {
    console.log(
      "getLimits: there is no local file with limits, use setLimits to write it"
    );
  }

  return limits;
}

//write limits to the database. If some fields aren't present, write stored, or default
function setLimits(limits) {
  //a missing limits row is treated as an empty object
  const localLimits = getKV("limits") || {};
  const limitsToWrite = new APILimits();

  if (limits && typeof limits === "object") {
    Object.keys(limitsToWrite).map((aLimit) => {
      if (Object.hasOwn(limits, aLimit)) {
        limitsToWrite[aLimit].limitTotal = limits[aLimit].limitTotal;
        limitsToWrite[aLimit].limitRemain = limits[aLimit].limitRemain;
      } else if (Object.hasOwn(localLimits, aLimit)) {
        limitsToWrite[aLimit].limitTotal = localLimits[aLimit].limitTotal;
        limitsToWrite[aLimit].limitRemain = localLimits[aLimit].limitRemain;
      } else {
        console.log(
          `setLimits: ${aLimit} is not present locally and in the passed limits, writing default`
        );
      }
    });
    putKV("limits", limitsToWrite);
  } else {
    console.log(
      `setLimits: ${limits} are not an object, nothing is written on disk`
    );
  }
}

module.exports = {
  getLimits,
  setLimits,
};
