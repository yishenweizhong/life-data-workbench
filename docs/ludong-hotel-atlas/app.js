(function () {
  "use strict";

  var COLORS = {
    blue: "#0071e3",
    green: "#248a3d",
    yellow: "#d08300",
    orange: "#e35f00",
    red: "#d70015",
    gray: "#86868b"
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
    markerMetric: "score",
    selectedHotelId: null,
    map: null,
    markers: [],
    mapReady: false,
    view: "map"
  };

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
    return state.markerMetric === "gmv"
      ? gmvColor(hotel.paymentGmv)
      : scoreColor(hotel.operationScore);
  }

  function formatScore(score) {
    return score === null || score === undefined
      ? "暂缺"
      : formatInteger(score) + " 分";
  }

  function markerGraphic() {
    return [
      '<svg class="hotel-pin-icon" viewBox="0 0 32 42" aria-hidden="true">',
      '<path class="hotel-pin-shape" d="M16 1.5C8.5 1.5 2.5 7.4 2.5 14.8c0 10 13.5 25.7 13.5 25.7s13.5-15.7 13.5-25.7C29.5 7.4 23.5 1.5 16 1.5Z"></path>',
      '<circle cx="16" cy="14.7" r="6.2" fill="#ffffff"></circle>',
      "</svg>"
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
    return hotels.slice().sort(function (a, b) {
      var aMissing = a.operationScore === null;
      var bMissing = b.operationScore === null;
      if ((state.sort === "score" || state.sort === "scoreLow") &&
          aMissing !== bMissing) return aMissing ? 1 : -1;
      if (state.sort === "score") return b.operationScore - a.operationScore;
      if (state.sort === "scoreLow") return a.operationScore - b.operationScore;
      if (state.sort === "nights") return b.paymentNights - a.paymentNights;
      return b.paymentGmv - a.paymentGmv;
    });
  }

  function updateMetrics() {
    var metrics = HotelCore.aggregateMetrics(state.filtered);
    byId("metricHotels").textContent = formatInteger(metrics.hotelCount);
    byId("metricRooms").textContent = formatInteger(metrics.paymentNights);
    byId("metricOccupancy").textContent = formatInteger(metrics.redeemNights);
    byId("metricAdr").textContent = formatInteger(metrics.operationScore);
    byId("metricGmv").textContent = (metrics.paymentGmv / 10000).toFixed(1);
    byId("resultCount").textContent = state.filtered.length + " 家";
    byId("overviewSubtitle").textContent =
      "当前 " + state.filtered.length + " 家门店，经营分覆盖 " +
      metrics.scoredHotelCount + " / " + metrics.hotelCount +
      "，数据周期 " + HOTEL_DATASET.period + "。";
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
      return [
        '<button class="hotel-row' + active + '" type="button" data-hotel-id="' + escapeHtml(hotel.id) + '">',
        '<i class="score-dot" style="--score-color:' + scoreColor(hotel.operationScore) + '"></i>',
        '<span class="hotel-row-main">',
        '<strong class="hotel-row-title">' + escapeHtml(hotel.name) + "</strong>",
        '<span class="hotel-row-meta">' + escapeHtml(hotel.city) + " · " +
          escapeHtml(hotel.district) + " · " +
          escapeHtml(hotel.provider || "未绑定") + "</span>",
        "</span>",
        '<span class="hotel-row-value">',
        '<span><strong>' + escapeHtml(formatScore(hotel.operationScore)) +
          "</strong> " + (hotel.operationScore === null
            ? ""
            : scoreDeltaMarkup(hotel.scoreDelta)) + "</span>",
        "<small>" + formatGmv(hotel.paymentGmv) + "</small>",
        "</span>",
        "</button>"
      ].join("");
    }).join("");
  }

  function legendData() {
    if (state.markerMetric === "gmv") {
      return [
        ["≥ 1 万", COLORS.green],
        ["3,000–9,999", COLORS.blue],
        ["1,000–2,999", COLORS.yellow],
        ["< 1,000", COLORS.red]
      ];
    }
    return [
      ["≥ 90 分", COLORS.green],
      ["75–89 分", COLORS.blue],
      ["60–74 分", COLORS.yellow],
      ["< 60 分", COLORS.red],
      ["经营分暂缺", COLORS.gray]
    ];
  }

  function renderLegend() {
    byId("mapLegend").innerHTML = legendData().map(function (item) {
      return '<span><i style="--legend-color:' + item[1] + '"></i>' +
        escapeHtml(item[0]) + "</span>";
    }).join("");
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
        markerGraphic(),
        "</button>"
      ].join("");
    }).join("");
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
        markerGraphic(),
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

    var hasCoordinates = Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat);
    var amapUrl = hasCoordinates
      ? "https://uri.amap.com/navigation?to=" + hotel.lng + "," + hotel.lat +
        "," + encodeURIComponent(hotel.name) +
        "&mode=car&policy=1&src=ludong-hotel-atlas&coordinate=gaode&callnative=1"
      : "";
    var certificationClass = hotel.certification === "已认证" ? "certified" : "";
    var gaps = hotel.scoreGaps || [];

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
    var isMap = view === "map";
    byId("mapStage").hidden = !isMap;
    byId("overviewStage").hidden = isMap;
    byId("mapViewButton").classList.toggle("active", isMap);
    byId("overviewViewButton").classList.toggle("active", !isMap);
    byId("mapViewButton").setAttribute("aria-selected", String(isMap));
    byId("overviewViewButton").setAttribute("aria-selected", String(!isMap));
    byId("markerMetric").closest("label").hidden = !isMap;
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
      renderMapMarkers(false);
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
    try {
      var result = await HotelAPI.loadHotels();
      state.hotels = result.data;
      byId("sourceLabel").textContent = result.source + " · " + result.data.length + " 家";
      renderFilterOptions();
      applyFilters(false);
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
