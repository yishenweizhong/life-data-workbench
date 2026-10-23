var HotelCore = (function () {
  "use strict";

  var FIELD_ALIASES = {
    name: ["酒店名称", "门店名称", "名称", "hotelName", "name"],
    brand: ["品牌", "brand"],
    district: ["区县", "区域", "行政区", "district"],
    city: ["城市", "地级市", "city"],
    address: ["地址", "详细地址", "address"],
    lng: ["经度", "longitude", "lng"],
    lat: ["纬度", "latitude", "lat"],
    rooms: ["房间数", "客房数", "rooms"],
    occupancy: ["入住率", "OCC", "occupancy"],
    adr: ["平均房价", "ADR", "adr"],
    monthlyGmv: ["月GMV", "月度GMV", "GMV", "monthlyGmv"],
    paymentNights: ["支付间夜", "paymentNights"],
    redeemNights: ["核销间夜", "redeemNights"],
    paymentGmv: ["近7日支付GMV", "支付GMV", "paymentGmv"],
    redeemGmv: ["近7日核销GMV", "核销GMV", "redeemGmv"],
    paymentGrowth: ["支付增长率", "paymentGrowth"],
    redeemGrowth: ["核销增长率", "redeemGrowth"],
    operationScore: ["经营分", "operationScore"],
    scoreDelta: ["近7天变化", "经营分变化", "scoreDelta"],
    certification: ["金冠认证", "认证状态", "certification"],
    poiId: ["POI ID", "poiId"],
    provider: ["服务商", "区域户名称", "provider"],
    status: ["状态", "经营状态", "status"],
    tier: ["分层", "等级", "tier"],
    manager: ["店长", "酒店联系人", "manager"],
    phone: ["联系电话", "电话", "phone"],
    owner: ["内部负责人", "负责人", "owner"],
    tags: ["标签", "tags"],
    note: ["备注", "note"]
  };

  function parseCSVRows(text) {
    var rows = [];
    var row = [];
    var value = "";
    var quoted = false;
    var i;

    for (i = 0; i < text.length; i += 1) {
      var char = text[i];
      var next = text[i + 1];
      if (char === '"' && quoted && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(value);
        if (row.some(function (cell) { return cell.trim() !== ""; })) rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    row.push(value);
    if (row.some(function (cell) { return cell.trim() !== ""; })) rows.push(row);
    return rows;
  }

  function findValue(record, aliases) {
    var i;
    for (i = 0; i < aliases.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(record, aliases[i])) return record[aliases[i]];
    }
    return "";
  }

  function toNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    var cleaned = String(value).replace(/[,\s￥¥]/g, "");
    var number = Number(cleaned);
    return Number.isFinite(number) ? number : fallback;
  }

  function toOccupancy(value) {
    if (value === null || value === undefined || value === "") return 0;
    var text = String(value).trim();
    var number = toNumber(text.replace("%", ""), 0);
    if (text.indexOf("%") >= 0 || number > 1) return number / 100;
    return number;
  }

  function toRatio(value) {
    if (value === null || value === undefined || value === "") return 0;
    var text = String(value).trim();
    var number = toNumber(text.replace("%", ""), 0);
    return text.indexOf("%") >= 0 ? number / 100 : number;
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split(/[|、，,]/).map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }

  function normalizeHotel(record, index) {
    var hotel = {};
    var paymentNights;
    var redeemNights;
    var paymentGmv;
    var redeemGmv;
    var redeemRate;
    var adr;
    Object.keys(FIELD_ALIASES).forEach(function (field) {
      hotel[field] = findValue(record, FIELD_ALIASES[field]);
    });
    paymentNights = Math.max(0, Math.round(toNumber(hotel.paymentNights, toNumber(hotel.rooms, 0))));
    redeemNights = hotel.redeemNights === "" ?
      Math.max(0, Math.round(paymentNights * toOccupancy(hotel.occupancy))) :
      Math.max(0, Math.round(toNumber(hotel.redeemNights, 0)));
    paymentGmv = Math.max(0, toNumber(hotel.paymentGmv, toNumber(hotel.monthlyGmv, 0)));
    redeemGmv = Math.max(0, toNumber(hotel.redeemGmv, 0));
    redeemRate = hotel.redeemNights === "" ?
      toOccupancy(hotel.occupancy) :
      (paymentNights ? redeemNights / paymentNights : 0);
    adr = toNumber(hotel.adr, paymentNights ? paymentGmv / paymentNights : 0);
    return {
      id: record.id || "hotel-import-" + Date.now() + "-" + index,
      name: String(hotel.name || "").trim(),
      brand: String(hotel.brand || "未标注").trim(),
      district: String(hotel.district || "待确认").trim(),
      city: String(hotel.city || "城市待确认").trim(),
      address: String(hotel.address || "").trim(),
      lng: toNumber(hotel.lng, null),
      lat: toNumber(hotel.lat, null),
      rooms: paymentNights,
      occupancy: hotel.redeemNights === "" ?
        Math.max(0, Math.min(1, redeemRate)) :
        Math.max(0, redeemRate),
      adr: Math.max(0, adr),
      monthlyGmv: paymentGmv,
      paymentNights: paymentNights,
      redeemNights: redeemNights,
      paymentGmv: paymentGmv,
      redeemGmv: redeemGmv,
      paymentGrowth: toRatio(hotel.paymentGrowth),
      redeemGrowth: toRatio(hotel.redeemGrowth),
      operationScore: hotel.operationScore === "" ?
        null : Math.max(0, toNumber(hotel.operationScore, 0)),
      scoreDelta: hotel.scoreDelta === "" ?
        null : toNumber(hotel.scoreDelta, 0),
      certification: String(hotel.certification || "未认证").trim(),
      poiId: String(hotel.poiId || "").trim(),
      provider: String(hotel.provider || hotel.owner || "").trim(),
      status: String(hotel.status || "正常").trim(),
      tier: String(hotel.tier || "C").trim().toUpperCase(),
      manager: String(hotel.manager || "").trim(),
      phone: String(hotel.phone || "").trim(),
      owner: String(hotel.owner || "").trim(),
      tags: normalizeTags(hotel.tags),
      note: String(hotel.note || "").trim(),
      updatedAt: record.updatedAt || new Date().toISOString()
    };
  }

  function parseHotelCSV(text) {
    var rows = parseCSVRows(String(text || "").replace(/^\uFEFF/, ""));
    if (rows.length < 2) return { hotels: [], errors: ["文件中没有可导入的数据"] };
    var headers = rows[0].map(function (header) { return header.trim(); });
    var hotels = [];
    var errors = [];

    rows.slice(1).forEach(function (row, rowIndex) {
      var record = {};
      headers.forEach(function (header, columnIndex) {
        record[header] = row[columnIndex] === undefined ? "" : row[columnIndex].trim();
      });
      var hotel = normalizeHotel(record, rowIndex + 2);
      if (!hotel.name) {
        errors.push("第 " + (rowIndex + 2) + " 行：酒店名称为空");
      } else {
        hotels.push(hotel);
      }
    });
    return { hotels: hotels, errors: errors };
  }

  function searchableText(hotel) {
    return [
      hotel.name, hotel.brand, hotel.district, hotel.city, hotel.address,
      hotel.manager, hotel.owner, hotel.provider, hotel.poiId,
      hotel.certification, (hotel.tags || []).join(" ")
    ].join(" ").toLowerCase();
  }

  function filterHotels(hotels, filters) {
    var state = filters || {};
    var query = String(state.query || "").trim().toLowerCase();
    return (hotels || []).filter(function (hotel) {
      if (query && searchableText(hotel).indexOf(query) < 0) return false;
      if (state.district && state.district !== "全部" && hotel.district !== state.district) return false;
      if (state.city && state.city !== "全部" && hotel.city !== state.city) return false;
      if (state.brand && state.brand !== "全部" && hotel.brand !== state.brand) return false;
      if (state.provider && state.provider !== "全部" && hotel.provider !== state.provider) return false;
      if (state.certification && state.certification !== "全部" && hotel.certification !== state.certification) return false;
      if (state.scoreAvailability === "有经营分" && hotel.operationScore === null) return false;
      if (state.scoreAvailability === "经营分暂缺" && hotel.operationScore !== null) return false;
      if (state.tier && state.tier !== "全部" && hotel.tier !== state.tier) return false;
      if (state.status && state.status !== "全部" && hotel.status !== state.status) return false;
      return true;
    });
  }

  function aggregateMetrics(hotels) {
    var list = hotels || [];
    var paymentNights = 0;
    var redeemNights = 0;
    var paymentGmv = 0;
    var redeemGmv = 0;
    var operationScoreTotal = 0;
    var scoredHotelCount = 0;
    list.forEach(function (hotel) {
      paymentNights += toNumber(hotel.paymentNights, toNumber(hotel.rooms, 0));
      redeemNights += toNumber(hotel.redeemNights, 0);
      paymentGmv += toNumber(hotel.paymentGmv, toNumber(hotel.monthlyGmv, 0));
      redeemGmv += toNumber(hotel.redeemGmv, 0);
      if (hotel.operationScore !== null && hotel.operationScore !== undefined) {
        operationScoreTotal += toNumber(hotel.operationScore, 0);
        scoredHotelCount += 1;
      }
    });
    return {
      hotelCount: list.length,
      paymentNights: paymentNights,
      redeemNights: redeemNights,
      paymentGmv: paymentGmv,
      redeemGmv: redeemGmv,
      redeemRate: paymentNights ? redeemNights / paymentNights : 0,
      adr: paymentNights ? paymentGmv / paymentNights : 0,
      operationScore: scoredHotelCount ? operationScoreTotal / scoredHotelCount : 0,
      scoredHotelCount: scoredHotelCount,
      roomCount: paymentNights,
      occupancy: paymentNights ? redeemNights / paymentNights : 0,
      monthlyGmv: paymentGmv
    };
  }

  function escapeCSV(value) {
    var text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toHotelCSV(hotels) {
    var columns = [
      ["门店名称", "name"], ["品牌", "brand"], ["二级片区", "district"],
      ["城市", "city"],
      ["地址", "address"], ["经度", "lng"], ["纬度", "lat"],
      ["支付间夜", "paymentNights"], ["核销间夜", "redeemNights"],
      ["近7日支付GMV", "paymentGmv"], ["近7日核销GMV", "redeemGmv"],
      ["支付增长率", "paymentGrowth"], ["核销增长率", "redeemGrowth"],
      ["经营分", "operationScore"], ["近7天变化", "scoreDelta"],
      ["金冠认证", "certification"], ["POI ID", "poiId"], ["服务商", "provider"],
      ["状态", "status"], ["分层", "tier"], ["平均房价", "adr"],
      ["店长", "manager"], ["联系电话", "phone"], ["内部负责人", "owner"],
      ["标签", "tags"], ["备注", "note"]
    ];
    var rows = [columns.map(function (column) { return column[0]; }).join(",")];
    (hotels || []).forEach(function (hotel) {
      rows.push(columns.map(function (column) {
        var value = hotel[column[1]];
        if (column[1] === "tags") value = (value || []).join("|");
        return escapeCSV(value);
      }).join(","));
    });
    return rows.join("\n");
  }

  return {
    parseHotelCSV: parseHotelCSV,
    normalizeHotel: normalizeHotel,
    filterHotels: filterHotels,
    aggregateMetrics: aggregateMetrics,
    toHotelCSV: toHotelCSV
  };
}());
