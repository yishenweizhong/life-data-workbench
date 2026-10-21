var HotelAPI = (function () {
  "use strict";

  var STORAGE_KEY = "tianjin-hotel-atlas.hotels.v2";
  var SOURCE_KEY = "tianjin-hotel-atlas.source.v2";

  function baselineSource() {
    return HOTEL_DATASET.source;
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function loadHotels() {
    // TODO replace with GET /api/hotels -> { data: Hotel[], source: DataSource }
    await delay(220);
    var stored = localStorage.getItem(STORAGE_KEY);
    var source = localStorage.getItem(SOURCE_KEY) || baselineSource();
    if (!stored) return { data: clone(HOTEL_SEED), source: baselineSource() };
    try {
      return { data: JSON.parse(stored), source: source };
    } catch (error) {
      return { data: clone(HOTEL_SEED), source: baselineSource(), warning: "本地数据损坏，已恢复工作台源数据" };
    }
  }

  async function saveHotels(hotels, source) {
    // TODO replace with PUT /api/hotels/batch -> { success: true, count: number }
    await delay(180);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hotels));
    localStorage.setItem(SOURCE_KEY, source || "本地维护");
    return { success: true, count: hotels.length };
  }

  async function updateHotel(hotels, hotelId, patch) {
    // TODO replace with PATCH /api/hotels/:id -> { data: Hotel }
    await delay(240);
    var next = hotels.map(function (hotel) {
      if (hotel.id !== hotelId) return hotel;
      return Object.assign({}, hotel, patch, { updatedAt: new Date().toISOString() });
    });
    await saveHotels(next, "本地维护");
    return { data: next };
  }

  async function importHotels(existing, incoming, mode, fileName) {
    // TODO replace with POST /api/hotels/import -> { data: Hotel[], summary: ImportSummary }
    await delay(360);
    var next = mode === "replace" ? incoming : existing.concat(incoming);
    var seen = {};
    next = next.filter(function (hotel) {
      var key = [hotel.name, hotel.address, hotel.lng, hotel.lat].join("|").toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    await saveHotels(next, "导入：" + fileName);
    return {
      data: next,
      summary: {
        imported: incoming.length,
        total: next.length,
        duplicatesRemoved: existing.length + incoming.length - next.length
      }
    };
  }

  async function resetHotels() {
    // TODO replace with POST /api/hotels/reset-demo -> { data: Hotel[] }
    await delay(200);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SOURCE_KEY);
    return { data: clone(HOTEL_SEED), source: baselineSource() };
  }

  return {
    loadHotels: loadHotels,
    saveHotels: saveHotels,
    updateHotel: updateHotel,
    importHotels: importHotels,
    resetHotels: resetHotels
  };
}());
