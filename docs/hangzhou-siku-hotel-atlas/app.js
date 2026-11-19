(function () {
  "use strict";

  var COLORS = {
    blue: "#0071e3",
    green: "#248a3d",
    yellow: "#d08300",
    orange: "#e35f00",
    red: "#d70015",
    gray: "#86868b",
    live: "#1d5798",
    idle: "#b07b2e",
    none: "#b8b2a7"
  };

  var LUDONG_BOUNDS = {
    minLng: 117.0,
    maxLng: 123.5,
    minLat: 34.0,
    maxLat: 39.5
  };

  var state = {
    hotels: [],
    filtered: [],
    query: "",
    district: "全部",
    city: "全部",
    brand: "全部",
    provider: "全部",
    certification: "全部",
    scoreAvailability: "全部",
    sort: "gmv",
    markerMetric: "city",
    selectedHotelId: null,
    map: null,
    markers: [],
    mapReady: false,
    view: "map",
    liveMode: false,
    live: window.LUDONG_LIVE || null
  };

  var liveByPoi = {};
  if (state.live && state.live.stores) {
    state.live.stores.forEach(function (item) {
      liveByPoi[String(item.poiId)] = item;
    });
  }

  function liveRecord(poiId) {
    return liveByPoi[String(poiId)] || null;
  }

  function liveStatusColor(status) {
    if (status === "已开播") return COLORS.live;
    if (status === "有记录未开播") return COLORS.idle;
    return COLORS.none;
  }

  var CITY_PALETTE = [
    "#1d5798", "#2f7f7a", "#b07b2e", "#7a5a8a", "#5b7c3f",
    "#a35b45", "#4b6a8a", "#8a7a3f", "#6f8f9a", "#9a6a5a"
  ];
  var cityColorMap = {};
  var cityCounts = {};
  (function buildCityColors() {
    var counts = {};
    (window.HOTEL_SEED || []).forEach(function (hotel) {
      var city = hotel.city || "城市未知";
      counts[city] = (counts[city] || 0) + 1;
    });
    var cities = Object.keys(counts).sort(function (a, b) {
      if (a === "城市未知") return 1;
      if (b === "城市未知") return -1;
      return counts[b] - counts[a] || a.localeCompare(b, "zh-CN");
    });
    cities.forEach(function (city, index) {
      cityColorMap[city] = CITY_PALETTE[index % CITY_PALETTE.length];
      cityCounts[city] = counts[city];
    });
  }());

  function cityColor(city) {
    return cityColorMap[city || "城市未知"] || COLORS.gray;
  }

  function octoberTotals(hotel) {
    if (!hotel || !hotel.october || !hotel.october.totals) {
      return { "核销金额": 0, "核销间夜": 0, "意向成交金额": 0, "意向成交间夜": 0 };
    }
    return hotel.october.totals;
  }

  var NO_DATA_COLOR = "#a9a49a";
  var PAYMENT_BANDS = [
    { key: "lt1000", label: "< 1000", min: 0, max: 1000, color: "#b9b1a3" },
    { key: "1000-5000", label: "1000–5000", min: 1000, max: 5000, color: "#8fb8c9" },
    { key: "5000-10000", label: "5000–1 万", min: 5000, max: 10000, color: "#4f93b3" },
    { key: "10000-30000", label: "1 万–3 万", min: 10000, max: 30000, color: "#2f6f92" },
    { key: "30000-50000", label: "3 万–5 万", min: 30000, max: 50000, color: "#b07b2e" },
    { key: "50000-100000", label: "5 万–10 万", min: 50000, max: 100000, color: "#a34f2f" },
    { key: "ge100000", label: "10 万以上", min: 100000, max: Infinity, color: "#6f2f4f" }
  ];

  function paymentBand(hotel) {
    if (!hotel || !hotel.october) return null;
    var amount = Number(octoberTotals(hotel)["意向成交金额"]) || 0;
    for (var i = 0; i < PAYMENT_BANDS.length; i += 1) {
      var band = PAYMENT_BANDS[i];
      if (amount >= band.min && amount < band.max) return band;
    }
    return PAYMENT_BANDS[PAYMENT_BANDS.length - 1];
  }

  function paymentBandCounts(hotels) {
    var counts = {};
    PAYMENT_BANDS.forEach(function (band) { counts[band.key] = 0; });
    counts.noData = 0;
    (hotels || []).forEach(function (hotel) {
      var band = paymentBand(hotel);
      if (band) counts[band.key] += 1;
      else counts.noData += 1;
    });
    return counts;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function unique(values) {
    return values.filter(function (value, index, all) {
      return value && all.indexOf(value) === index;
    }).sort(function (a, b) {
      return String(a).localeCompare(String(b), "zh-CN");
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatInteger(value) {
    return Math.round(Number(value) || 0).toLocaleString("zh-CN");
  }

  function formatGmv(value) {
    var amount = Number(value) || 0;
    if (amount >= 100000000) return (amount / 100000000).toFixed(1) + " 亿元";
    if (amount >= 10000) return (amount / 10000).toFixed(amount >= 1000000 ? 0 : 1) + " 万元";
    return formatInteger(amount) + " 元";
  }

  function formatRatio(value) {
    var number = Number(value) || 0;
    var sign = number > 0 ? "+" : "";
    return sign + (number * 100).toFixed(1) + "%";
  }

  function formatDate(value) {
    if (!value) return "未记录";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function scoreColor(score) {
    if (score === null || score === undefined) return COLORS.gray;
    var value = Number(score) || 0;
    if (value >= 90) return COLORS.green;
    if (value >= 75) return COLORS.blue;
    if (value >= 60) return COLORS.yellow;
    return COLORS.red;
  }

  function gmvColor(gmv) {
    var value = Number(gmv) || 0;
    if (value >= 10000) return COLORS.green;
    if (value >= 3000) return COLORS.blue;
    if (value >= 1000) return COLORS.yellow;
    return COLORS.red;
  }

  function markerColor(hotel) {
    if (state.markerMetric === "payment") {
      var band = paymentBand(hotel);
      return band ? band.color : NO_DATA_COLOR;
    }
    return cityColor(hotel.city);
  }

  function formatScore(score) {
    return score === null || score === undefined
      ? "暂缺"
      : formatInteger(score) + " 分";
  }

  function markerGraphic(hotel) {
    return [
      '<svg class="hotel-pin-icon" viewBox="0 0 32 42" aria-hidden="true">',
      '<path class="hotel-pin-shape" d="M16 1.5C8.5 1.5 2.5 7.4 2.5 14.8c0 10 13.5 25.7 13.5 25.7s13.5-15.7 13.5-25.7C29.5 7.4 23.5 1.5 16 1.5Z"></path>',
      '<circle cx="16" cy="14.7" r="6.2" fill="#ffffff"></circle>',
      "</svg>",
      '<span class="hotel-marker-name">' + escapeHtml(hotel.name) + "</span>"
    ].join("");
  }

  function toast(message, type) {
    var region = byId("toastRegion");
    var node = document.createElement("div");
    node.className = "toast" + (type === "error" ? " toast-error" : "");
    node.innerHTML = "<i></i><span>" + escapeHtml(message) + "</span>";
    region.appendChild(node);
    window.setTimeout(function () {
      node.classList.add("toast-leave");
      window.setTimeout(function () { node.remove(); }, 220);
    }, 2800);
  }

  function fillSelect(id, values, current) {
    var select = byId(id);
    select.innerHTML = ["全部"].concat(values).map(function (value) {
      return "<option" + (value === current ? " selected" : "") + ">" +
        escapeHtml(value) + "</option>";
    }).join("");
  }

  function renderFilterOptions() {
    fillSelect("districtFilter", unique(state.hotels.map(function (hotel) {
      return hotel.district;
    })), state.district);
    fillSelect("cityFilter", unique(state.hotels.map(function (hotel) {
      return hotel.city;
    })), state.city);
    fillSelect("brandFilter", unique(state.hotels.map(function (hotel) {
      return hotel.brand;
    })), state.brand);
    fillSelect("providerFilter", unique(state.hotels.map(function (hotel) {
      return hotel.provider || "未绑定";
    })), state.provider);
    fillSelect("certificationFilter", unique(state.hotels.map(function (hotel) {
      return hotel.certification;
    })), state.certification);
  }

  function sortHotels(hotels) {
    function value(hotel, key) {
      return Number(octoberTotals(hotel)[key]) || 0;
    }
    return hotels.slice().sort(function (a, b) {
      if (state.sort === "intent") {
        return value(b, "意向成交金额") - value(a, "意向成交金额");
      }
      if (state.sort === "nights") {
        return value(b, "核销间夜") - value(a, "核销间夜");
      }
      return value(b, "核销金额") - value(a, "核销金额");
    });
  }

  function updateMetrics() {
    var totals = state.filtered.reduce(function (sum, hotel) {
      var item = octoberTotals(hotel);
      sum.redeem += Number(item["核销金额"]) || 0;
      sum.redeemNights += Number(item["核销间夜"]) || 0;
      sum.intent += Number(item["意向成交金额"]) || 0;
      sum.intentNights += Number(item["意向成交间夜"]) || 0;
      return sum;
    }, { redeem: 0, redeemNights: 0, intent: 0, intentNights: 0 });
    byId("metricHotels").textContent = formatInteger(state.filtered.length);
    byId("metricRooms").textContent = (totals.redeem / 10000).toFixed(1);
    byId("metricOccupancy").textContent = formatInteger(totals.redeemNights);
    byId("metricAdr").textContent = (totals.intent / 10000).toFixed(1);
    byId("metricGmv").textContent = formatInteger(totals.intentNights);
    byId("resultCount").textContent = state.filtered.length + " 家";
    byId("overviewSubtitle").textContent =
      "当前 " + state.filtered.length + " 家绑定门店，数据来自鲁东10.xlsx，周期 " +
      HOTEL_DATASET.period + "。";
  }

  function scoreDeltaMarkup(value) {
    var number = Number(value) || 0;
    var className = number > 0 ? "positive" : number < 0 ? "negative" : "neutral";
    return '<span class="score-delta ' + className + '">' +
      (number > 0 ? "+" : "") + formatInteger(number) + "</span>";
  }

  function renderHotelList() {
    var container = byId("hotelList");
    if (!state.filtered.length) {
      container.innerHTML = [
        '<div class="empty-state">',
        "<strong>没有符合条件的门店</strong>",
        "<span>调整筛选条件或清空搜索</span>",
        '<button class="button button-secondary" type="button" data-reset-filters>重置筛选</button>',
        "</div>"
      ].join("");
      return;
    }

    container.innerHTML = state.filtered.map(function (hotel) {
      var active = hotel.id === state.selectedHotelId ? " active" : "";
      var totals = octoberTotals(hotel);
      return [
        '<button class="hotel-row' + active + '" type="button" data-hotel-id="' + escapeHtml(hotel.id) + '">',
        '<i class="score-dot" style="--score-color:' + cityColor(hotel.city) + '"></i>',
        '<span class="hotel-row-main">',
        '<strong class="hotel-row-title">' + escapeHtml(hotel.name) + "</strong>",
        '<span class="hotel-row-meta">' + escapeHtml(hotel.city || "城市未知") + " · " +
          escapeHtml(hotel.district || "片区未知") + " · POI " +
          escapeHtml(hotel.poiId) + "</span>",
        "</span>",
        '<span class="hotel-row-value">',
        '<span><strong>' + formatGmv(totals["核销金额"]) + "</strong></span>",
        "<small>" + (hotel.october
          ? "意向 " + formatGmv(totals["意向成交金额"])
          : "鲁东10无数据") + "</small>",
        "</span>",
        "</button>"
      ].join("");
    }).join("");
  }

  function legendData() {
    if (state.markerMetric === "payment") {
      var counts = paymentBandCounts(state.filtered);
      var items = PAYMENT_BANDS.map(function (band) {
        return [band.label + " " + counts[band.key], band.color];
      });
      if (counts.noData) {
        items.push(["无 10 月数据 " + counts.noData, NO_DATA_COLOR]);
      }
      return items;
    }
    return Object.keys(cityColorMap).map(function (city) {
      return [city + " " + cityCounts[city], cityColorMap[city]];
    });
  }

  function renderLegend() {
    byId("mapLegend").innerHTML = legendData().map(function (item) {
      return '<span><i style="--legend-color:' + item[1] + '"></i>' +
        escapeHtml(item[0]) + "</span>";
    }).join("");
  }

  function renderCitySummary() {
    var rail = byId("controlRail");
    var scrollTop = rail ? rail.scrollTop : 0;
    var cities = Object.keys(cityCounts).sort(function (a, b) {
      if (a === "城市未知") return 1;
      if (b === "城市未知") return -1;
      return cityCounts[b] - cityCounts[a] || a.localeCompare(b, "zh-CN");
    });
    byId("citySummaryCount").textContent =
      "绑定 " + HOTEL_DATASET.count + " 家 · 可上图 " + HOTEL_DATASET.located + " 家";
    byId("cityList").innerHTML = cities.map(function (city) {
      var amount = state.hotels.reduce(function (sum, hotel) {
        return sum + ((hotel.city || "城市未知") === city
          ? octoberTotals(hotel)["核销金额"] : 0);
      }, 0);
      var unknown = city === "城市未知";
      var tag = unknown ? "div" : "button";
      var attrs = unknown ? "" : ' type="button" data-city-filter="' + escapeHtml(city) + '"';
      var active = state.city === city ? " active" : "";
      return "<" + tag + ' class="city-row' + active + '"' + attrs + ">" +
        '<i class="city-dot" style="--city-color:' + cityColor(city) + '"></i>' +
        '<span class="city-name">' + escapeHtml(city) + "</span>" +
        '<span class="city-meta">' + cityCounts[city] + " 家 · " +
          formatGmv(amount) + "</span>" +
        "</" + tag + ">";
    }).join("");
    var exceptions = HOTEL_DATASET.exceptions || [];
    byId("exceptionCount").textContent = exceptions.length;
    byId("exceptionList").innerHTML = exceptions.map(function (item) {
      return "<div>" +
        "<span><strong>" + escapeHtml(item.name) + "</strong><small>" +
          escapeHtml(item.reason) + (item.city ? " · " + escapeHtml(item.city) : "") +
        "</small></span>" +
        "<em>" + (item.hasData ? formatGmv(item.redeemAmount) : "无数据") + "</em>" +
        "</div>";
    }).join("");
    if (rail) rail.scrollTop = scrollTop;
  }

  function renderBandSummary() {
    var box = byId("paymentBands");
    if (!box) return;
    if (state.markerMetric !== "payment") {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    var counts = paymentBandCounts(state.filtered);
    var rows = PAYMENT_BANDS.map(function (band) {
      return '<div class="payment-band-row">' +
        '<i style="--band-color:' + band.color + '"></i>' +
        '<span>' + band.label + "</span>" +
        "<strong>" + counts[band.key] + " 家</strong>" +
        "</div>";
    });
    if (counts.noData) {
      rows.push('<div class="payment-band-row">' +
        '<i style="--band-color:' + NO_DATA_COLOR + '"></i>' +
        "<span>无 10 月数据</span><strong>" + counts.noData + " 家</strong></div>");
    }
    box.innerHTML = rows.join("");
  }

  function renderLiveSummary() {
    var live = state.live;
    if (!live) return;
    var summary = live.summary;
    byId("liveSummaryRange").textContent =
      live.meta.start + " 至 " + live.meta.end + " · 全量 " + summary.total + " 家";
    byId("liveCountLive").textContent = summary.live + " 家";
    byId("liveCountIdle").textContent = summary.idle + " 家";
    byId("liveCountNone").textContent = summary.noRecord + " 家";
    byId("liveTotals").innerHTML = [
      "<span>场次 <strong>" + formatInteger(summary.sessions) + "</strong></span>",
      "<span>时长 <strong>" + Number(summary.hours).toFixed(1) + "h</strong></span>",
      "<span>直播支付 <strong>" + formatGmv(summary.payment) + "</strong></span>",
      "<span>开播账号 <strong>" + formatInteger(summary.accounts) + "</strong></span>",
      "<span>地图可定位 <strong>" + formatInteger(live.meta.locatableCount) + " / " +
        formatInteger(summary.total) + "</strong></span>"
    ].join("");
    byId("liveAreaList").innerHTML = live.areas.map(function (area) {
      var tone = area.live > 0 ? "live" : (area.idle > 0 ? "idle" : "none");
      var tag = area.district === "未匹配片区" ? "div" : "button";
      var attrs = area.district === "未匹配片区"
        ? ""
        : ' type="button" data-live-district="' + escapeHtml(area.district) + '"';
      var active = area.district === state.district ? " active" : "";
      return "<" + tag + ' class="live-area-row' + active + '"' + attrs + ">" +
        '<i class="live-dot ' + tone + '"></i>' +
        '<span class="live-area-name">' + escapeHtml(area.district) + "</span>" +
        '<span class="live-area-count">' + area.live + " / " + area.total + "</span>" +
        '<span class="live-area-pay">' + formatGmv(area.payment) + "</span>" +
        "</" + tag + ">";
    }).join("");
    var unlocated = live.unlocated || [];
    byId("liveUnlocatedCount").textContent = unlocated.length;
    byId("liveUnlocatedList").innerHTML = unlocated.map(function (item) {
      return "<div>" +
        "<span><strong>" + escapeHtml(item.name) + "</strong><small>" +
          escapeHtml(item.district || "未匹配片区") + " · " +
          escapeHtml(item.status) + "</small></span>" +
        "<em>" + formatInteger(item.sessions) + " 场 · " +
          formatGmv(item.payment) + "</em>" +
        "</div>";
    }).join("") || '<div class="live-empty">当前没有无法定位的门店</div>';
  }

  function projectToFallback(hotel) {
    var x = ((hotel.lng - LUDONG_BOUNDS.minLng) /
      (LUDONG_BOUNDS.maxLng - LUDONG_BOUNDS.minLng)) * 100;
    var y = ((LUDONG_BOUNDS.maxLat - hotel.lat) /
      (LUDONG_BOUNDS.maxLat - LUDONG_BOUNDS.minLat)) * 100;
    return { x: clamp(x, 4, 96), y: clamp(y, 6, 94) };
  }

  function renderFallbackMarkers() {
    byId("fallbackMarkers").innerHTML = state.filtered.filter(function (hotel) {
      return Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat);
    }).map(function (hotel) {
      var point = projectToFallback(hotel);
      var active = hotel.id === state.selectedHotelId ? " active" : "";
      return [
        '<button class="fallback-marker' + active + '" type="button"',
        ' data-hotel-id="' + escapeHtml(hotel.id) + '"',
        ' style="left:' + point.x + "%;top:" + point.y + "%;--marker-color:" +
          markerColor(hotel) + '"',
        ' title="' + escapeHtml(hotel.name) + '">',
        markerGraphic(hotel),
        "</button>"
      ].join("");
    }).join("");
    HotelMapLabels.refresh();
  }

  function destroyMapMarkers() {
    if (state.map && state.markers.length) state.map.remove(state.markers);
    state.markers = [];
  }

  function fitCurrentMarkers() {
    if (!state.mapReady || !state.map || !state.markers.length) return;
    if (state.markers.length === 1) {
      var onlyHotel = state.filtered.find(function (hotel) {
        return Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat);
      });
      state.map.setZoomAndCenter(14, [onlyHotel.lng, onlyHotel.lat], false, 280);
      return;
    }
    state.map.setFitView(state.markers, false, [76, 76, 76, 76], 12);
  }

  function renderMapMarkers(shouldFit) {
    renderFallbackMarkers();
    renderLegend();
    if (!state.mapReady || !state.map || !window.AMap) return;

    destroyMapMarkers();
    state.markers = state.filtered.filter(function (hotel) {
      return Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat);
    }).map(function (hotel) {
      var content = [
        '<div class="amap-hotel-marker' +
          (hotel.id === state.selectedHotelId ? " active" : "") + '"',
        ' data-hotel-id="' + escapeHtml(hotel.id) + '"',
        ' style="--marker-color:' + markerColor(hotel) + '"',
        ' title="' + escapeHtml(hotel.name) + '">',
        markerGraphic(hotel),
        "</div>"
      ].join("");
      var marker = new window.AMap.Marker({
        position: [hotel.lng, hotel.lat],
        content: content,
        offset: new window.AMap.Pixel(-16, -42),
        extData: { hotelId: hotel.id },
        zIndex: hotel.id === state.selectedHotelId ? 150 : 100
      });
      marker.on("click", function () {
        selectHotel(hotel.id, true);
      });
      return marker;
    });
    if (state.markers.length) state.map.add(state.markers);
    if (shouldFit) fitCurrentMarkers();
    HotelMapLabels.refresh();
  }

  function renderOverview() {
    var groups = {};
    state.filtered.forEach(function (hotel) {
      if (!groups[hotel.district]) {
        groups[hotel.district] = { district: hotel.district, hotels: [], gmv: 0 };
      }
      groups[hotel.district].hotels.push(hotel);
      groups[hotel.district].gmv += Number(hotel.paymentGmv) || 0;
    });
    var districts = Object.keys(groups).map(function (key) {
      var item = groups[key];
      item.metrics = HotelCore.aggregateMetrics(item.hotels);
      return item;
    }).sort(function (a, b) {
      return b.gmv - a.gmv;
    });
    var maxGmv = districts.length ? districts[0].gmv : 1;

    byId("districtBars").innerHTML = districts.map(function (item, index) {
      var width = Math.max(2, (item.gmv / maxGmv) * 100);
      return [
        '<div class="district-bar-row">',
        '<div class="district-bar-label"><strong>' + escapeHtml(item.district) + "</strong>",
        "<span>" + item.hotels.length + " 家 · 均分 " +
          formatInteger(item.metrics.operationScore) + "（" +
          item.metrics.scoredHotelCount + " 家有分）</span></div>",
        '<div class="district-bar-track"><div class="district-bar-fill" style="width:' +
          width + "%;animation-delay:" + (index * 35) + 'ms"></div></div>',
        "<strong class=\"district-bar-value\">" + (item.gmv / 10000).toFixed(1) + "</strong>",
        "</div>"
      ].join("");
    }).join("") || '<div class="empty-state"><strong>暂无片区数据</strong></div>';

    var certificationBase = state.filtered.filter(function (hotel) {
      return hotel.certification !== "暂缺";
    });
    var certified = certificationBase.filter(function (hotel) {
      return hotel.certification === "已认证";
    }).length;
    var total = certificationBase.length;
    var unverified = total - certified;
    var rate = total ? certified / total : 0;
    var donut = byId("certificationDonut");
    donut.style.background = "conic-gradient(" + COLORS.green + " 0 " +
      (rate * 100) + "%, #e8e8ed " + (rate * 100) + "% 100%)";
    donut.innerHTML = "<div><strong>" + Math.round(rate * 100) +
      "%</strong><span>认证率</span></div>";
    byId("certificationLegend").innerHTML = [
      '<div><span><i style="background:' + COLORS.green + '"></i>已认证</span><strong>' +
        certified + " 家</strong></div>",
      '<div><span><i style="background:#d1d1d6"></i>未认证</span><strong>' +
        unverified + " 家</strong></div>"
    ].join("");

    var lowScores = state.filtered.filter(function (hotel) {
      return hotel.operationScore !== null;
    }).sort(function (a, b) {
      return a.operationScore - b.operationScore;
    }).slice(0, 5);
    byId("attentionList").innerHTML = lowScores.map(function (hotel) {
      return [
        '<button class="attention-item" type="button" data-hotel-id="' + escapeHtml(hotel.id) + '">',
        '<i style="--score-color:' + scoreColor(hotel.operationScore) + '"></i>',
        "<span><strong>" + escapeHtml(hotel.name) + "</strong><small>" +
          escapeHtml((hotel.scoreGaps || []).join(" · ") || "查看经营详情") + "</small></span>",
        "<em>" + formatInteger(hotel.operationScore) + " 分</em>",
        "</button>"
      ].join("");
    }).join("") || '<div class="empty-state"><strong>暂无门店数据</strong></div>';
  }

  function applyFilters(shouldFit) {
    state.filtered = sortHotels(HotelCore.filterHotels(state.hotels, {
      query: state.query,
      district: state.district,
      city: state.city,
      brand: state.brand,
      provider: state.provider,
      certification: state.certification,
      scoreAvailability: state.scoreAvailability
    }));
    if (state.selectedHotelId && !state.filtered.some(function (hotel) {
      return hotel.id === state.selectedHotelId;
    })) {
      state.selectedHotelId = null;
      renderDetail();
    }
    updateMetrics();
    renderHotelList();
    renderMapMarkers(Boolean(shouldFit));
    renderOverview();
    renderLegend();
    renderBandSummary();
    if (state.liveMode) renderLiveSummary();
  }

  function resetFilters() {
    state.query = "";
    state.district = "全部";
    state.city = "全部";
    state.brand = "全部";
    state.provider = "全部";
    state.certification = "全部";
    state.scoreAvailability = "全部";
    byId("globalSearch").value = "";
    byId("districtFilter").value = "全部";
    byId("cityFilter").value = "全部";
    byId("brandFilter").value = "全部";
    byId("providerFilter").value = "全部";
    byId("certificationFilter").value = "全部";
    byId("scoreAvailabilityFilter").value = "全部";
    applyFilters(true);
  }

  function metricCard(label, value, secondary, tone) {
    return [
      '<div class="detail-metric' + (tone ? " " + tone : "") + '">',
      "<span>" + escapeHtml(label) + "</span>",
      "<strong>" + escapeHtml(value) + "</strong>",
      secondary ? "<small>" + escapeHtml(secondary) + "</small>" : "",
      "</div>"
    ].join("");
  }

  function renderSikuDetail(hotel) {
    var drawer = byId("detailDrawer");
    var hasCoordinates = Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat);
    var amapUrl = hasCoordinates
      ? "https://uri.amap.com/navigation?to=" + hotel.lng + "," + hotel.lat +
        "," + encodeURIComponent(hotel.name) +
        "&mode=car&policy=1&src=siku-hotel-atlas&coordinate=gaode&callnative=1"
      : "";
    var totals = octoberTotals(hotel);
    var october = hotel.october;
    var body = "";
    if (october) {
      body = [
        '<div class="detail-metrics">',
        metricCard("核销金额", formatGmv(totals["核销金额"]),
          october.rowCount + " 条体裁记录"),
        metricCard("核销间夜", formatInteger(totals["核销间夜"]) + " 间", "2026 年 10 月"),
        metricCard("意向成交金额", formatGmv(totals["意向成交金额"]), "10 月累计"),
        metricCard("意向成交间夜", formatInteger(totals["意向成交间夜"]) + " 间", "10 月累计"),
        "</div>",
        '<div class="october-table-wrap"><table class="october-table">',
        "<thead><tr><th>交易体裁</th><th>核销金额</th><th>核销间夜</th>",
        "<th>意向成交金额</th><th>意向间夜</th></tr></thead><tbody>",
        october.breakdown.map(function (row) {
          return "<tr><td>" + escapeHtml(row["交易体裁"]) + "</td>" +
            "<td>" + formatGmv(row["核销金额"]) + "</td>" +
            "<td>" + formatInteger(row["核销间夜"]) + "</td>" +
            "<td>" + formatGmv(row["意向成交金额"]) + "</td>" +
            "<td>" + formatInteger(row["意向成交间夜"]) + "</td></tr>";
        }).join(""),
        '<tr class="october-total"><td>合计</td><td>' +
          formatGmv(totals["核销金额"]) + "</td><td>" +
          formatInteger(totals["核销间夜"]) + "</td><td>" +
          formatGmv(totals["意向成交金额"]) + "</td><td>" +
          formatInteger(totals["意向成交间夜"]) + "</td></tr>",
        "</tbody></table></div>",
        '<p class="detail-live-note">数据来自鲁东10.xlsx，按门店ID精确匹配，字段按交易体裁汇总；' +
          "金额单位元，间夜单位间。</p>"
      ].join("");
    } else {
      body = '<p class="detail-live-empty">鲁东10.xlsx 没有该门店的 10 月数据。' +
        "该门店仅按杭州四库绑定清单保留，不做估算或补齐。</p>";
    }
    byId("detailContent").innerHTML = [
      '<header class="detail-head">',
      '<div class="detail-title-wrap">',
      '<div class="detail-eyebrow"><span>' + escapeHtml(hotel.city || "城市未知") +
        " · " + escapeHtml(hotel.district || "片区未知") + "</span>",
      '<span class="certification-badge certified">杭州四库</span></div>',
      "<h2>" + escapeHtml(hotel.name) + "</h2>",
      '<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>' +
        escapeHtml(hotel.address || "地址待补充") + "</p>",
      "</div>",
      '<button class="icon-button" type="button" data-detail-action="close" aria-label="关闭详情" title="关闭">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
      "</button></header>",
      '<section class="detail-section detail-score-section">',
      '<div class="detail-section-head"><div><span>2026 年 10 月</span><h3>全部数据</h3></div>',
      "<small>月 " + escapeHtml(october ? october.month : "2026/10") + "</small></div>",
      body,
      "</section>",
      '<section class="detail-section">',
      '<div class="detail-section-head"><div><span>组织信息</span><h3>门店归属</h3></div></div>',
      '<dl class="detail-list">',
      "<div><dt>城市</dt><dd>" + escapeHtml(hotel.city || "待确认") + "</dd></div>",
      "<div><dt>业务片区</dt><dd>" + escapeHtml(hotel.district || "待确认") + "</dd></div>",
      "<div><dt>服务商</dt><dd>杭州四库传媒有限公司</dd></div>",
      "<div><dt>POI ID</dt><dd>" + escapeHtml(hotel.poiId || "未记录") + "</dd></div>",
      "</dl></section>",
      '<footer class="detail-actions">',
      hasCoordinates ? '<a class="button button-primary" href="' +
        escapeHtml(amapUrl) + '" target="_blank" rel="noopener">' :
        '<span class="button button-secondary" aria-disabled="true">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>',
      "<span>" + (hasCoordinates ? "高德导航" : "坐标待确认") +
        "</span>" + (hasCoordinates ? "</a>" : "</span>"),
      "</footer>"
    ].join("");
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  }

  function renderDetail() {
    var drawer = byId("detailDrawer");
    var hotel = state.hotels.find(function (item) {
      return item.id === state.selectedHotelId;
    });
    if (!hotel) {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      byId("detailContent").innerHTML = "";
      return;
    }
    if (Object.prototype.hasOwnProperty.call(hotel, "october")) {
      renderSikuDetail(hotel);
      return;
    }

    var hasCoordinates = Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat);
    var amapUrl = hasCoordinates
      ? "https://uri.amap.com/navigation?to=" + hotel.lng + "," + hotel.lat +
        "," + encodeURIComponent(hotel.name) +
        "&mode=car&policy=1&src=ludong-hotel-atlas&coordinate=gaode&callnative=1"
      : "";
    var certificationClass = hotel.certification === "已认证" ? "certified" : "";
    var gaps = hotel.scoreGaps || [];
    var liveRecordData = liveRecord(hotel.poiId);
    var liveSection = "";
    if (state.live) {
      var liveStatus = liveRecordData ? liveRecordData.status : "无账号记录";
      var liveTone = liveStatus === "已开播" ? "live" :
        (liveStatus === "有记录未开播" ? "idle" : "none");
      var liveBody = liveRecordData && liveStatus !== "无账号记录"
        ? '<div class="detail-metrics">' +
            metricCard("直播场次", formatInteger(liveRecordData.sessions) + " 场",
              formatInteger(liveRecordData.accounts) + " 个账号") +
            metricCard("直播时长", Number(liveRecordData.hours).toFixed(1) + " 小时",
              "近 7 天累计") +
            metricCard("直播支付", formatGmv(liveRecordData.payment), "直播成交金额") +
            metricCard("账号总核销", formatGmv(liveRecordData.redeem), "账号总口径") +
          "</div>"
        : '<p class="detail-live-empty">近 7 天没有该门店的商家官号账号记录。这可能只是未纳入采集，不能直接当作未开播。</p>';
      liveSection = [
        '<section class="detail-section detail-live-section">',
        '<div class="detail-section-head"><div><span>直播</span><h3>近 7 天开播</h3></div>',
        '<small class="live-status ' + liveTone + '">' + escapeHtml(liveStatus) + "</small></div>",
        liveBody,
        '<p class="detail-live-note">核销为账号总核销，包含直播、视频、搜索等归因来源，不等于直播核销，也不等于门店全渠道核销。</p>',
        "</section>"
      ].join("");
    }

    byId("detailContent").innerHTML = [
      '<header class="detail-head">',
      '<div class="detail-title-wrap">',
      '<div class="detail-eyebrow"><span>' + escapeHtml(hotel.district) + "</span>",
      '<span class="certification-badge ' + certificationClass + '">' +
        escapeHtml(hotel.certification) + "</span></div>",
      "<h2>" + escapeHtml(hotel.name) + "</h2>",
      '<p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>' +
        escapeHtml(hotel.address || "地址待补充") + "</p>",
      "</div>",
      '<button class="icon-button" type="button" data-detail-action="close" aria-label="关闭详情" title="关闭">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
      "</button>",
      "</header>",
      '<section class="detail-section detail-score-section">',
      '<div class="detail-section-head"><div><span>经营快照</span><h3>核心指标</h3></div>',
      "<small>更新于 " + escapeHtml(formatDate(hotel.updatedAt)) + "</small></div>",
      '<div class="detail-metrics">',
      metricCard("经营分", formatScore(hotel.operationScore),
        hotel.operationScore === null ? "该门店经营分暂缺" :
          "较前 7 天 " + (hotel.scoreDelta > 0 ? "+" : "") +
          formatInteger(hotel.scoreDelta),
        hotel.operationScore === null ? "" :
          "score-" + (hotel.operationScore >= 75 ? "good" : "low")),
      metricCard("支付间夜", formatInteger(hotel.paymentNights) + " 间",
        formatRatio(hotel.paymentGrowth) + " 环比"),
      metricCard("核销间夜", formatInteger(hotel.redeemNights) + " 间",
        formatRatio(hotel.redeemGrowth) + " 环比"),
      metricCard("近 7 日支付", formatGmv(hotel.paymentGmv), "真实支付 GMV"),
      "</div>",
      "</section>",
      liveSection,
      '<section class="detail-section">',
      '<div class="detail-section-head"><div><span>组织信息</span><h3>门店归属</h3></div></div>',
      '<dl class="detail-list">',
      "<div><dt>品牌</dt><dd>" + escapeHtml(hotel.brand || "未标注") + "</dd></div>",
      "<div><dt>城市</dt><dd>" + escapeHtml(hotel.city || "待确认") + "</dd></div>",
      "<div><dt>服务商</dt><dd>" + escapeHtml(hotel.provider || "未绑定") + "</dd></div>",
      "<div><dt>区域户</dt><dd>" + escapeHtml(hotel.owner || "未绑定") + "</dd></div>",
      "<div><dt>POI ID</dt><dd>" + escapeHtml(hotel.poiId || "未记录") + "</dd></div>",
      "</dl>",
      "</section>",
      '<section class="detail-section">',
      '<div class="detail-section-head"><div><span>经营诊断</span><h3>当前提升项</h3></div></div>',
      '<div class="gap-list">' + (gaps.length ? gaps.map(function (gap) {
        return '<span><i></i>' + escapeHtml(gap) + "</span>";
      }).join("") : '<span class="gap-empty">当前未记录明显提升项</span>') + "</div>",
      "</section>",
      '<footer class="detail-actions">',
      hasCoordinates ? '<a class="button button-primary" href="' +
        escapeHtml(amapUrl) + '" target="_blank" rel="noopener">' :
        '<span class="button button-secondary" aria-disabled="true">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>',
      "<span>" + (hasCoordinates ? "高德导航" : "坐标待确认") +
        "</span>" + (hasCoordinates ? "</a>" : "</span>"),
      "</footer>"
    ].join("");
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  }

  function updateMarkerSelection() {
    document.querySelectorAll(".amap-hotel-marker, .fallback-marker").forEach(function (marker) {
      marker.classList.toggle(
        "active",
        marker.getAttribute("data-hotel-id") === state.selectedHotelId
      );
    });
    state.markers.forEach(function (marker) {
      var ext = marker.getExtData ? marker.getExtData() : {};
      if (marker.setzIndex) marker.setzIndex(ext.hotelId === state.selectedHotelId ? 150 : 100);
    });
    HotelMapLabels.refresh();
  }

  function selectHotel(hotelId, focusMap) {
    state.selectedHotelId = hotelId;
    renderHotelList();
    renderDetail();
    updateMarkerSelection();
    if (focusMap && state.mapReady && state.map) {
      var hotel = state.hotels.find(function (item) { return item.id === hotelId; });
      if (hotel && Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat)) {
        state.map.setZoomAndCenter(
          Math.max(state.map.getZoom(), 14),
          [hotel.lng, hotel.lat],
          false,
          280
        );
      }
    }
    closeMobilePanel();
  }

  function closeDetail() {
    state.selectedHotelId = null;
    renderDetail();
    renderHotelList();
    updateMarkerSelection();
  }

  function setView(view) {
    state.view = view;
    state.liveMode = view === "live";
    var isMap = view === "map" || view === "live";
    byId("mapStage").hidden = !isMap;
    byId("overviewStage").hidden = isMap;
    byId("mapViewButton").classList.toggle("active", view === "map");
    byId("overviewViewButton").classList.toggle("active", view === "overview");
    byId("liveViewButton").classList.toggle("active", state.liveMode);
    byId("mapViewButton").setAttribute("aria-selected", String(view === "map"));
    byId("overviewViewButton").setAttribute("aria-selected", String(view === "overview"));
    byId("liveViewButton").setAttribute("aria-selected", String(state.liveMode));
    byId("liveSummary").hidden = !state.liveMode;
    byId("markerMetric").closest("label").hidden = view !== "map";
    document.body.classList.toggle("live-mode", state.liveMode);
    renderLegend();
    if (state.liveMode) renderLiveSummary();
    renderMapMarkers(false);
    if (isMap && state.mapReady && state.map) {
      window.setTimeout(function () {
        state.map.resize();
      }, 80);
    }
  }

  function showMapFallback(reason) {
    state.mapReady = false;
    byId("amapContainer").style.display = "none";
    byId("fallbackMap").hidden = false;
    var message = byId("mapMessage");
    message.hidden = false;
    message.classList.add("error");
    message.innerHTML = "<span>" +
      escapeHtml(reason || "地图连接失败，已切换鲁东示意图") + "</span>";
    renderFallbackMarkers();
  }

  function initializeMap() {
    var attempts = 0;
    var interval = window.setInterval(function () {
      attempts += 1;
      if (window.AMap && window.AMap.Map) {
        window.clearInterval(interval);
        try {
          state.map = new window.AMap.Map("amapContainer", {
            center: [119.8, 36.4],
            zoom: 7.2,
            viewMode: "2D",
            mapStyle: "amap://styles/normal",
            showLabel: true,
            resizeEnable: true,
            zooms: [7, 18]
          });
          state.map.addControl(new window.AMap.Scale({ position: "LB" }));
          state.map.on("moveend", HotelMapLabels.refresh);
          state.map.on("zoomend", HotelMapLabels.refresh);
          state.map.on("resize", HotelMapLabels.refresh);
          state.map.addControl(new window.AMap.ToolBar({
            position: "RB",
            liteStyle: true
          }));
          var timer = window.setTimeout(function () {
            if (!state.mapReady) showMapFallback("地图加载超时，已切换鲁东示意图");
          }, 8000);
          state.map.on("complete", function () {
            window.clearTimeout(timer);
            state.mapReady = true;
            byId("fallbackMap").hidden = true;
            byId("amapContainer").style.display = "block";
            byId("mapMessage").hidden = true;
            renderMapMarkers(true);
          });
        } catch (error) {
          showMapFallback("地图初始化失败，已切换鲁东示意图");
        }
      } else if (attempts >= 50) {
        window.clearInterval(interval);
        showMapFallback("地图未加载，已切换鲁东示意图");
      }
    }, 160);
  }

  function exportCurrent() {
    var data = state.filtered.length ? state.filtered : state.hotels;
    if (!data.length) {
      toast("当前没有可导出的门店", "error");
      return;
    }
    var csv = "\uFEFF" + HotelCore.toHotelCSV(data);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "鲁东酒店经营数据-" + HOTEL_DATASET.asOf + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("已导出当前范围 " + data.length + " 家门店");
  }

  function openMobilePanel() {
    byId("controlRail").classList.add("open");
    byId("mobileScrim").classList.add("show");
  }

  function closeMobilePanel() {
    byId("controlRail").classList.remove("open");
    byId("mobileScrim").classList.remove("show");
  }

  function bindEvents() {
    byId("globalSearch").addEventListener("input", function (event) {
      state.query = event.target.value;
      applyFilters(true);
    });
    [
      ["districtFilter", "district"],
      ["cityFilter", "city"],
      ["brandFilter", "brand"],
      ["providerFilter", "provider"],
      ["certificationFilter", "certification"],
      ["scoreAvailabilityFilter", "scoreAvailability"]
    ].forEach(function (binding) {
      byId(binding[0]).addEventListener("change", function (event) {
        state[binding[1]] = event.target.value;
        applyFilters(true);
      });
    });
    byId("sortControl").addEventListener("change", function (event) {
      state.sort = event.target.value;
      applyFilters(false);
    });
    byId("markerMetric").addEventListener("change", function (event) {
      state.markerMetric = event.target.value;
      renderLegend();
      renderBandSummary();
      renderMapMarkers(false);
    });
    byId("liveAreaList").addEventListener("click", function (event) {
      var row = event.target.closest("[data-live-district]");
      if (!row) return;
      state.district = row.getAttribute("data-live-district");
      byId("districtFilter").value = state.district;
      applyFilters(true);
      renderLiveSummary();
    });
    byId("cityList").addEventListener("click", function (event) {
      var row = event.target.closest("[data-city-filter]");
      if (!row) return;
      var rail = byId("controlRail");
      var scrollTop = rail ? rail.scrollTop : 0;
      state.city = row.getAttribute("data-city-filter");
      byId("cityFilter").value = state.city;
      applyFilters(true);
      renderCitySummary();
      if (rail) rail.scrollTop = scrollTop;
    });
    byId("resetFilters").addEventListener("click", resetFilters);
    byId("hotelList").addEventListener("click", function (event) {
      var hotelButton = event.target.closest("[data-hotel-id]");
      if (hotelButton) selectHotel(hotelButton.getAttribute("data-hotel-id"), true);
      if (event.target.closest("[data-reset-filters]")) resetFilters();
    });
    byId("fallbackMarkers").addEventListener("click", function (event) {
      var marker = event.target.closest("[data-hotel-id]");
      if (marker) selectHotel(marker.getAttribute("data-hotel-id"), false);
    });
    byId("attentionList").addEventListener("click", function (event) {
      var item = event.target.closest("[data-hotel-id]");
      if (!item) return;
      setView("map");
      selectHotel(item.getAttribute("data-hotel-id"), true);
    });
    byId("detailContent").addEventListener("click", function (event) {
      if (event.target.closest('[data-detail-action="close"]')) closeDetail();
    });
    byId("mapViewButton").addEventListener("click", function () { setView("map"); });
    byId("overviewViewButton").addEventListener("click", function () { setView("overview"); });
    byId("liveViewButton").addEventListener("click", function () { setView("live"); });
    byId("mapResetButton").addEventListener("click", fitCurrentMarkers);
    byId("exportButton").addEventListener("click", exportCurrent);
    byId("mobilePanelToggle").addEventListener("click", openMobilePanel);
    byId("closeMobilePanel").addEventListener("click", closeMobilePanel);
    byId("mobileScrim").addEventListener("click", closeMobilePanel);
    document.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        byId("globalSearch").focus();
      }
      if (event.key === "Escape") {
        if (byId("detailDrawer").classList.contains("open")) closeDetail();
        else closeMobilePanel();
      }
    });
  }

  async function init() {
    bindEvents();
    renderLegend();
    if (!state.live) {
      byId("liveViewButton").hidden = true;
    } else {
      renderLiveSummary();
    }
    try {
      var result = await HotelAPI.loadHotels();
      state.hotels = result.data;
      byId("sourceLabel").textContent = result.source + " · " + result.data.length + " 家";
      renderFilterOptions();
      applyFilters(false);
      renderCitySummary();
      renderBandSummary();
    } catch (error) {
      state.hotels = HOTEL_SEED.slice();
      byId("sourceLabel").textContent = HOTEL_DATASET.source + " · " +
        HOTEL_SEED.length + " 家";
      renderFilterOptions();
      applyFilters(false);
      toast("数据加载异常，已恢复内置真实快照", "error");
    }
    initializeMap();
  }

  document.addEventListener("DOMContentLoaded", init);
}());
