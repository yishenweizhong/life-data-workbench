var HotelAPI = (function () {
  "use strict";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function loadHotels() {
    return {
      data: clone(HOTEL_SEED),
      source: HOTEL_DATASET.source
    };
  }

  return {
    loadHotels: loadHotels
  };
}());
