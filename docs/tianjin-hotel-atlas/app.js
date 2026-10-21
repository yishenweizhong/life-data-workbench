(function () {
  "use strict";

  var STATUS_COLORS = {
    "正常": "#2e7d5b",
    "关注": "#c38a2f",
    "风险": "#bc4b45",
    "筹备": "#8b948f"
  };

  var TIER_COLORS = {
    A: "#176b5b",
    B: "#447c9d",
    C: "#7b817e",
    D: "#d86f45"
  };

  var TIANJIN_BOUNDS = {
    minLng: 116.7,
    maxLng: 118.1,
    minLat: 38.55,
    maxLat: 40.3
  };

  var state = {
    hotels: [],
    filtered: [],
    source: HOTEL_DATASET.source,
    query: "",
    district: "全部",
    brand: "全部",
    provider: "全部",
    tier: "全部",
    status: "全部",
    sort: "gmv",
    markerMetric: "status",
    view: "map",
    selectedHotelId: null,
    map: null,
    markers: [],
    cluster: null,
    mapReady: false,
    pendingImport: null
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
    return values.filter(function (value, index, array) {
      return value && array.indexOf(value) === index;
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
    if (amount >= 100000000) return (amount / 100000000).toFixed(1) + "亿";
    if (amount >= 10000) return (amount / 10000).toFixed(amount >= 1000000 ? 0 : 1) + "万";
    return formatInteger(amount);
  }

  function formatDate(value) {
    if (!value) return "未记录";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function markerColor(hotel, metric) {
    if (metric === "tier") return TIER_COLORS[hotel.tier] || "#7b817e";
    if (metric === "score") {
      if (hotel.operationScore >= 90) return "#2e7d5b";
      if (hotel.operationScore >= 75) return "#447c9d";
      if (hotel.operationScore >= 60) return "#c38a2f";
      return "#bc4b45";
    }
    if (metric === "gmv") {
      if (hotel.paymentGmv >= 5000) return "#176b5b";
      if (hotel.paymentGmv >= 2500) return "#447c9d";
      if (hotel.paymentGmv >= 1000) return "#c38a2f";
      return "#bc4b45";
    }
    return STATUS_COLORS[hotel.status] || "#8b948f";
  }

  function markerLabel(hotel) {
    if (state.markerMetric === "score") return Math.round(hotel.operationScore);
    if (state.markerMetric === "gmv") return hotel.paymentGmv >= 10000 ?
      Math.round(hotel.paymentGmv / 10000) + "万" :
      Math.round(hotel.paymentGmv / 1000) + "k";
    return state.markerMetric === "tier" ? hotel.tier : hotel.status.slice(0, 1);
  }

  function markerGraphic(hotel) {
    return [
      '<svg class="hotel-pin-icon" viewBox="0 0 24 31" aria-hidden="true">',
      '<path fill="#d92d20" stroke="#ffffff" stroke-width="1.4" d="M12 1.2C6.4 1.2 2 5.6 2 11.1c0 7.4 10 18.5 10 18.5s10-11.1 10-18.5C22 5.6 17.6 1.2 12 1.2Z"></path>',
      '<circle cx="12" cy="11" r="5.8" fill="#ffffff"></circle>',
      "</svg>",
      '<span class="marker-pin-value">' + escapeHtml(markerLabel(hotel)) + "</span>"
    ].join("");
  }

  function statusStyle(status) {
    return STATUS_COLORS[status] || "#8b948f";
  }

  function toast(message, type) {
    var region = byId("toastRegion");
    var node = document.createElement("div");
    node.className = "toast" + (type === "error" ? " error" : "");
    node.innerHTML = "<i></i><span>" + escapeHtml(message) + "</span>";
    region.appendChild(node);
    window.setTimeout(function () {
      node.style.opacity = "0";
      node.style.transform = "translateX(12px)";
      window.setTimeout(function () { node.remove(); }, 180);
    }, 3200);
  }

  function updateSourceState() {
    var sourceState = byId("sourceState");
    var imported = state.source !== HOTEL_DATASET.source;
    sourceState.classList.toggle("imported", imported);
    byId("sourceLabel").textContent = state.source + " · " + state.hotels.length + " 家";
    byId("settingsSource").textContent = state.source;
    byId("settingsCount").textContent = state.hotels.length + " 家";
  }

  function fillSelect(id, values, current) {
    var select = byId(id);
    var options = ["全部"].concat(values);
    select.innerHTML = options.map(function (value) {
      return "<option" + (value === current ? " selected" : "") + ">" + escapeHtml(value) + "</option>";
    }).join("");
  }

  function renderFilterOptions() {
    fillSelect("districtFilter", unique(state.hotels.map(function (hotel) { return hotel.district; })), state.district);
    fillSelect("brandFilter", unique(state.hotels.map(function (hotel) { return hotel.brand; })), state.brand);
    fillSelect("providerFilter", unique(state.hotels.map(function (hotel) { return hotel.provider; })), state.provider);
  }

  function sortHotels(hotels) {
    return hotels.slice().sort(function (a, b) {
      if (state.sort === "name") return a.name.localeCompare(b.name, "zh-CN");
      if (state.sort === "score") return b.operationScore - a.operationScore;
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
  }

  function renderHotelList() {
    var container = byId("hotelList");
    if (!state.filtered.length) {
      container.innerHTML = [
        '<div class="empty-list"><div>',
        "<strong>没有符合条件的酒店</strong>",
        "<span>调整筛选条件或清空搜索后再试</span>",
        '<button class="button button-quiet" type="button" data-reset-filters>清空筛选</button>',
        "</div></div>"
      ].join("");
      return;
    }

    container.innerHTML = state.filtered.map(function (hotel) {
      var active = hotel.id === state.selectedHotelId ? " active" : "";
      return [
        '<button class="hotel-row' + active + '" type="button" data-hotel-id="' + escapeHtml(hotel.id) + '">',
        '<span class="status-pin" style="--status-color:' + statusStyle(hotel.status) + '"></span>',
        '<span class="hotel-row-main">',
        '<span class="hotel-row-title"><strong>' + escapeHtml(hotel.name) + '</strong><em class="tier-tag">' + escapeHtml(hotel.tier) + "</em></span>",
        '<span class="hotel-row-meta"><span>' + escapeHtml(hotel.district) + '</span><i></i><span>' + escapeHtml(hotel.brand) + "</span></span>",
        "</span>",
        '<span class="hotel-row-value"><strong>' + formatInteger(hotel.operationScore) + ' 分</strong><span>' + formatGmv(hotel.paymentGmv) + " 支付</span></span>",
        "</button>"
      ].join("");
    }).join("");
  }

  function legendData() {
    if (state.markerMetric === "tier") {
      return [
        ["A 层", TIER_COLORS.A], ["B 层", TIER_COLORS.B],
        ["C 层", TIER_COLORS.C], ["D 层", TIER_COLORS.D]
      ];
    }
    if (state.markerMetric === "score") {
      return [
        ["≥90分", "#2e7d5b"], ["75–89分", "#447c9d"],
        ["60–74分", "#c38a2f"], ["<60分", "#bc4b45"]
      ];
    }
    if (state.markerMetric === "gmv") {
      return [
        ["≥5000元", "#176b5b"], ["2500–4999元", "#447c9d"],
        ["1000–2499元", "#c38a2f"], ["<1000元", "#bc4b45"]
      ];
    }
    return [
      ["正常", STATUS_COLORS["正常"]], ["关注", STATUS_COLORS["关注"]],
      ["风险", STATUS_COLORS["风险"]], ["筹备", STATUS_COLORS["筹备"]]
    ];
  }

  function renderLegend() {
    byId("mapLegend").innerHTML = legendData().map(function (item) {
      return '<span class="legend-item"><i style="--legend-color:' + item[1] + '"></i>' + escapeHtml(item[0]) + "</span>";
    }).join("");
  }

  function projectToFallback(hotel) {
    var x = ((hotel.lng - TIANJIN_BOUNDS.minLng) / (TIANJIN_BOUNDS.maxLng - TIANJIN_BOUNDS.minLng)) * 100;
    var y = ((TIANJIN_BOUNDS.maxLat - hotel.lat) / (TIANJIN_BOUNDS.maxLat - TIANJIN_BOUNDS.minLat)) * 100;
    return { x: clamp(x, 4, 96), y: clamp(y, 6, 94) };
  }

  function renderFallbackMarkers() {
    var container = byId("fallbackMarkers");
    container.innerHTML = state.filtered.filter(function (hotel) {
      return Number.isFinite(hotel.lng) && Number.isFinite(hotel.lat);
    }).map(function (hotel) {
      var point = projectToFallback(hotel);
      var active = hotel.id === state.selectedHotelId ? " active" : "";
      return [
        '<button class="fallback-marker' + active + '" type="button"',
        ' data-hotel-id="' + escapeHtml(hotel.id) + '"',
        ' style="left:' + point.x + "%;top:" + point.y + "%;--marker-color:" + markerColor(hotel, state.markerMetric) + '"',
        ' title="' + escapeHtml(hotel.name) + '">',
        markerGraphic(hotel),
        "</button>"
      ].join("");
    }).join("");
  }

  function destroyMapMarkers() {
    if (state.cluster && typeof state.cluster.setMap === "function") {
      state.cluster.setMap(null);
      state.cluster = null;
    }
    if (state.map && state.markers.length) state.map.remove(state.markers);
    state.markers = [];
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
        '<div class="amap-hotel-marker' + (hotel.id === state.selectedHotelId ? " active" : "") + '"',
        ' data-hotel-id="' + escapeHtml(hotel.id) + '"',
        ' style="--marker-color:' + markerColor(hotel, state.markerMetric) + '"',
        ' title="' + escapeHtml(hotel.name) + '">',
        markerGraphic(hotel),
        "</div>"
      ].join("");
      var marker = new window.AMap.Marker({
        position: [hotel.lng, hotel.lat],
        content: content,
        offset: new window.AMap.Pixel(-17, -44),
        extData: { hotelId: hotel.id }
      });
      marker.on("click", function () { selectHotel(hotel.id, true); });
      return marker;
    });

    if (state.markers.length) {
      state.map.add(state.markers);
    }

    if (shouldFit && state.markers.length) {
      state.map.setFitView(state.markers, false, [72, 72, 72, 72], 11);
    }
  }

  function renderOverview() {
    var districtMap = {};
    state.filtered.forEach(function (hotel) {
      if (!districtMap[hotel.district]) districtMap[hotel.district] = { district: hotel.district, hotels: [], gmv: 0 };
      districtMap[hotel.district].hotels.push(hotel);
      districtMap[hotel.district].gmv += hotel.paymentGmv || 0;
    });
    var districts = Object.keys(districtMap).map(function (key) {
      var item = districtMap[key];
      item.metrics = HotelCore.aggregateMetrics(item.hotels);
      return item;
    }).sort(function (a, b) { return b.gmv - a.gmv; });
    var maxGmv = districts.length ? districts[0].gmv : 1;

    byId("districtBars").innerHTML = districts.slice(0, 12).map(function (item, index) {
      var width = Math.max(3, (item.gmv / maxGmv) * 100);
      return [
        '<div class="district-bar-row">',
        "<span>" + escapeHtml(item.district) + "</span>",
        '<div class="district-bar-track"><div class="district-bar-fill" style="width:' + width + "%;animation-delay:" + (index * 30) + 'ms"></div></div>',
        '<strong class="district-bar-value">' + (item.gmv / 10000).toFixed(0) + "</strong>",
        "</div>"
      ].join("");
    }).join("") || '<div class="empty-list"><div><strong>暂无区域数据</strong><span>请调整筛选条件</span></div></div>';

    var statuses = ["正常", "关注", "风险", "筹备"];
    var counts = statuses.map(function (status) {
      return state.filtered.filter(function (hotel) { return hotel.status === status; }).length;
    });
    var total = state.filtered.length;
    var cursor = 0;
    var gradients = statuses.map(function (status, index) {
      var start = cursor;
      cursor += total ? (counts[index] / total) * 100 : 0;
      return STATUS_COLORS[status] + " " + start + "% " + cursor + "%";
    });
    var donut = byId("statusDonut");
    donut.style.background = total ? "conic-gradient(" + gradients.join(",") + ")" : "#dfe4df";
    donut.innerHTML = "<div><strong>" + total + "</strong><span>家酒店</span></div>";

    byId("statusLegend").innerHTML = statuses.map(function (status, index) {
      return '<div class="status-legend-row"><i style="background:' + STATUS_COLORS[status] + '"></i><span>' + status + '</span><strong>' + counts[index] + "</strong></div>";
    }).join("");

    var attention = state.filtered.filter(function (hotel) {
      return hotel.status === "风险" || hotel.status === "关注";
    }).sort(function (a, b) { return a.operationScore - b.operationScore; }).slice(0, 5);
    byId("attentionList").innerHTML = attention.map(function (hotel) {
      return [
        '<button class="attention-item" type="button" data-hotel-id="' + escapeHtml(hotel.id) + '">',
        '<i style="background:' + STATUS_COLORS[hotel.status] + '"></i>',
        "<span>" + escapeHtml(hotel.name) + "</span>",
        "<strong>" + formatInteger(hotel.operationScore) + " 分</strong>",
        "</button>"
      ].join("");
    }).join("") || '<div class="attention-item"><i style="background:#2e7d5b"></i><span>当前范围暂无风险酒店</span><strong>良好</strong></div>';
  }

  function applyFilters(shouldFit) {
    state.filtered = sortHotels(HotelCore.filterHotels(state.hotels, {
      query: state.query,
      district: state.district,
      brand: state.brand,
      provider: state.provider,
      tier: state.tier,
      status: state.status
    }));
    updateMetrics();
    renderHotelList();
    renderMapMarkers(Boolean(shouldFit));
    renderOverview();
  }

  function resetFilters() {
    state.query = "";
    state.district = "全部";
    state.brand = "全部";
    state.provider = "全部";
    state.tier = "全部";
    state.status = "全部";
    byId("globalSearch").value = "";
    byId("districtFilter").value = "全部";
    byId("brandFilter").value = "全部";
    byId("providerFilter").value = "全部";
    byId("tierFilter").value = "全部";
    byId("statusFilter").value = "全部";
    applyFilters(true);
  }

  function renderDetail() {
    var hotel = state.hotels.find(function (item) { return item.id === state.selectedHotelId; });
    if (!hotel) {
      byId("detailDrawer").classList.remove("open");
      byId("detailDrawer").setAttribute("aria-hidden", "true");
      return;
    }

    var amapUrl = "https://uri.amap.com/marker?position=" + hotel.lng + "," + hotel.lat +
      "&name=" + encodeURIComponent(hotel.name) + "&src=tianjin-hotel-atlas&coordinate=gaode&callnative=1";

    byId("detailContent").innerHTML = [
      '<header class="detail-head">',
      "<div>",
      '<div class="detail-eyebrow"><span class="status-pin" style="--status-color:' + statusStyle(hotel.status) + '"></span>' +
        escapeHtml(hotel.status) + " · " + escapeHtml(hotel.district) + "</div>",
      "<h2>" + escapeHtml(hotel.name) + "</h2>",
      '<div class="detail-address">' + escapeHtml(hotel.address || "地址待补充") + "</div>",
      "</div>",
      '<button class="icon-button" type="button" data-detail-action="close" aria-label="关闭酒店详情">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
      "</button>",
      "</header>",
      '<section class="detail-section">',
      '<div class="detail-section-title"><h3>经营概览</h3><span>更新于 ' + escapeHtml(formatDate(hotel.updatedAt)) + "</span></div>",
      '<div class="detail-metrics">',
      '<div class="detail-metric"><span>经营分</span><strong>' + formatInteger(hotel.operationScore) + " 分</strong></div>",
      '<div class="detail-metric"><span>支付间夜</span><strong>' + formatInteger(hotel.paymentNights) + "</strong></div>",
      '<div class="detail-metric"><span>近7日支付</span><strong>' + formatGmv(hotel.paymentGmv) + "</strong></div>",
      '<div class="detail-metric"><span>核销间夜</span><strong>' + formatInteger(hotel.redeemNights) + "</strong></div>",
      "</div>",
      "</section>",
      '<section class="detail-section">',
      '<div class="detail-section-title"><h3>组织归属</h3><span>' + escapeHtml(hotel.brand) + "</span></div>",
      '<div class="contact-grid">',
      '<div class="contact-row"><span>服务商</span><strong>' + escapeHtml(hotel.provider || "未绑定") + "</strong></div>",
      '<div class="contact-row"><span>金冠认证</span><strong>' + escapeHtml(hotel.certification) + "</strong></div>",
      '<div class="contact-row"><span>区域户</span><strong>' + escapeHtml(hotel.owner || "待确认") + "</strong></div>",
      '<div class="contact-row"><span>POI ID</span><strong>' + escapeHtml(hotel.poiId || "待确认") + "</strong></div>",
      "</div>",
      "</section>",
      '<section class="detail-section">',
      '<div class="detail-section-title"><h3>标签</h3><span>' + hotel.tags.length + " 个</span></div>",
      '<div class="tag-list">' + (hotel.tags.length ? hotel.tags.map(function (tag) {
        return '<span class="tag">' + escapeHtml(tag) + "</span>";
      }).join("") : '<span class="tag">暂无标签</span>') + "</div>",
      "</section>",
      '<section class="detail-section">',
      '<div class="detail-section-title"><h3>资产维护</h3><span>保存在当前浏览器</span></div>',
      '<div class="detail-form-grid">',
      '<label><span>经营状态</span><select id="detailStatus">' + ["正常", "关注", "风险", "筹备"].map(function (status) {
        return "<option" + (status === hotel.status ? " selected" : "") + ">" + status + "</option>";
      }).join("") + "</select></label>",
      '<label><span>酒店分层</span><select id="detailTier">' + ["A", "B", "C", "D"].map(function (tier) {
        return "<option" + (tier === hotel.tier ? " selected" : "") + ">" + tier + "</option>";
      }).join("") + "</select></label>",
      "</div>",
      '<label class="detail-note-field"><span>跟进备注</span><textarea id="detailNote" placeholder="记录下一步动作或经营情况">' + escapeHtml(hotel.note || "") + "</textarea></label>",
      "</section>",
      '<footer class="detail-actions">',
      '<a class="button button-quiet" href="' + escapeHtml(amapUrl) + '" target="_blank" rel="noopener">高德导航</a>',
      '<button class="button button-primary" type="button" data-detail-action="save">保存更新</button>',
      "</footer>"
    ].join("");
    byId("detailDrawer").classList.add("open");
    byId("detailDrawer").setAttribute("aria-hidden", "false");
  }

  function updateMarkerSelection() {
    document.querySelectorAll(".amap-hotel-marker, .fallback-marker").forEach(function (marker) {
      marker.classList.toggle("active", marker.getAttribute("data-hotel-id") === state.selectedHotelId);
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
        state.map.setZoomAndCenter(Math.max(state.map.getZoom(), 13), [hotel.lng, hotel.lat], false, 280);
      }
    }
    closeMobilePanel();
  }

  async function saveDetail() {
    var button = document.querySelector('[data-detail-action="save"]');
    if (!button) return;
    button.disabled = true;
    button.textContent = "保存中";
    try {
      var result = await HotelAPI.updateHotel(state.hotels, state.selectedHotelId, {
        status: byId("detailStatus").value,
        tier: byId("detailTier").value,
        note: byId("detailNote").value.trim()
      });
      state.hotels = result.data;
      state.source = "本地维护";
      updateSourceState();
      renderFilterOptions();
      applyFilters(false);
      renderDetail();
      toast("酒店信息已保存");
    } catch (error) {
      button.disabled = false;
      button.textContent = "保存更新";
      toast("保存失败，请稍后重试", "error");
    }
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
      window.setTimeout(function () { state.map.resize(); }, 80);
    }
  }

  function showMapFallback(reason) {
    state.mapReady = false;
    byId("amapContainer").style.display = "none";
    byId("fallbackMap").hidden = false;
    var message = byId("mapMessage");
    message.classList.add("error");
    message.innerHTML = "<span>" + escapeHtml(reason || "高德地图暂不可用，已切换天津示意图") + "</span>";
    renderFallbackMarkers();
  }

  function initializeMap() {
    var attempts = 0;
    var maxAttempts = 40;
    var interval = window.setInterval(function () {
      attempts += 1;
      if (window.AMap && window.AMap.Map) {
        window.clearInterval(interval);
        try {
          state.map = new window.AMap.Map("amapContainer", {
            center: [117.22, 39.12],
            zoom: 9.7,
            viewMode: "2D",
            mapStyle: "amap://styles/normal",
            showLabel: true,
            resizeEnable: true,
            zooms: [7, 18]
          });
          state.map.addControl(new window.AMap.Scale({ position: "LB" }));
          state.map.addControl(new window.AMap.ToolBar({ position: "RB", liteStyle: true }));
          var completionTimer = window.setTimeout(function () {
            if (!state.mapReady) showMapFallback("地图连接超时，已切换天津示意图");
          }, 8000);
          state.map.on("complete", function () {
            window.clearTimeout(completionTimer);
            state.mapReady = true;
            byId("fallbackMap").hidden = true;
            byId("amapContainer").style.display = "block";
            byId("mapMessage").hidden = true;
            renderMapMarkers(true);
          });
        } catch (error) {
          showMapFallback("高德地图初始化失败，已切换天津示意图");
        }
      } else if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        showMapFallback("高德地图未加载，已切换天津示意图");
      }
    }, 200);
  }

  function resetMapView() {
    if (state.mapReady && state.map && state.markers.length) {
      state.map.setFitView(state.markers, false, [72, 72, 72, 72], 11);
    } else {
      var fallback = byId("fallbackMap");
      fallback.animate([
        { opacity: 0.72 },
        { opacity: 1 }
      ], { duration: 240, easing: "ease-out" });
    }
  }

  function openModal(id) {
    byId(id).hidden = false;
    document.body.setAttribute("data-modal-open", "true");
  }

  function closeModal(id) {
    byId(id).hidden = true;
    if (id === "importModal") resetImportState();
    if (!document.querySelector(".modal-backdrop:not([hidden])")) {
      document.body.removeAttribute("data-modal-open");
    }
  }

  function resetImportState() {
    state.pendingImport = null;
    byId("fileInput").value = "";
    byId("confirmImport").disabled = true;
    byId("confirmImport").textContent = "确认导入";
    byId("importPreview").innerHTML = [
      '<div class="template-row"><span>需要标准表头？</span>',
      '<a href="./hotel-import-template.csv" download>下载导入模板</a></div>'
    ].join("");
  }

  function parseJsonHotels(text) {
    var parsed = JSON.parse(text);
    var rows = Array.isArray(parsed) ? parsed : parsed.hotels;
    if (!Array.isArray(rows)) throw new Error("JSON 文件需要是酒店数组，或包含 hotels 数组");
    var hotels = [];
    var errors = [];
    rows.forEach(function (row, index) {
      var hotel = HotelCore.normalizeHotel(row, index + 1);
      if (!hotel.name) errors.push("第 " + (index + 1) + " 条：酒店名称为空");
      else hotels.push(hotel);
    });
    return { hotels: hotels, errors: errors };
  }

  function renderImportPreview(file, result) {
    state.pendingImport = {
      fileName: file.name,
      hotels: result.hotels,
      errors: result.errors
    };
    byId("confirmImport").disabled = result.hotels.length === 0;
    byId("importPreview").innerHTML = [
      '<div class="preview-summary"><span>' + escapeHtml(file.name) + '</span><strong>' + result.hotels.length + " 家有效",
      result.errors.length ? " · " + result.errors.length + " 条错误" : "",
      "</strong></div>",
      result.errors.length ? '<div class="preview-errors">' + result.errors.slice(0, 8).map(escapeHtml).join("<br>") + "</div>" : ""
    ].join("");
  }

  function handleFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast("文件超过 8MB，请拆分后导入", "error");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var result = file.name.toLowerCase().endsWith(".json")
          ? parseJsonHotels(String(reader.result))
          : HotelCore.parseHotelCSV(String(reader.result));
        renderImportPreview(file, result);
      } catch (error) {
        state.pendingImport = null;
        byId("confirmImport").disabled = true;
        byId("importPreview").innerHTML = '<div class="preview-errors">' + escapeHtml(error.message) + "</div>";
      }
    };
    reader.onerror = function () { toast("无法读取文件", "error"); };
    reader.readAsText(file, "UTF-8");
  }

  async function confirmImport() {
    if (!state.pendingImport || !state.pendingImport.hotels.length) return;
    var button = byId("confirmImport");
    var modeInput = document.querySelector('input[name="importMode"]:checked');
    button.disabled = true;
    button.textContent = "正在导入";
    try {
      var result = await HotelAPI.importHotels(
        state.hotels,
        state.pendingImport.hotels,
        modeInput ? modeInput.value : "replace",
        state.pendingImport.fileName
      );
      state.hotels = result.data;
      state.source = "导入：" + state.pendingImport.fileName;
      state.selectedHotelId = null;
      updateSourceState();
      renderFilterOptions();
      resetFilters();
      closeModal("importModal");
      toast("已导入 " + result.summary.imported + " 家酒店，当前共 " + result.summary.total + " 家");
    } catch (error) {
      button.disabled = false;
      button.textContent = "确认导入";
      toast("导入失败，请检查文件格式", "error");
    }
  }

  function exportCurrent() {
    var data = state.filtered.length ? state.filtered : state.hotels;
    if (!data.length) {
      toast("当前没有可导出的酒店", "error");
      return;
    }
    var csv = "\uFEFF" + HotelCore.toHotelCSV(data);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "天津酒店经营地图-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("已导出当前范围 " + data.length + " 家酒店");
  }

  async function restoreDemo() {
    if (!window.confirm("恢复工作台源数据会覆盖当前浏览器中的酒店清单，确定继续吗？")) return;
    var result = await HotelAPI.resetHotels();
    state.hotels = result.data;
    state.source = result.source;
    state.selectedHotelId = null;
    updateSourceState();
    renderFilterOptions();
    resetFilters();
    closeModal("settingsModal");
    toast("已恢复 2026-10-18 工作台源数据");
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
    byId("districtFilter").addEventListener("change", function (event) {
      state.district = event.target.value;
      applyFilters(true);
    });
    byId("brandFilter").addEventListener("change", function (event) {
      state.brand = event.target.value;
      applyFilters(true);
    });
    byId("providerFilter").addEventListener("change", function (event) {
      state.provider = event.target.value;
      applyFilters(true);
    });
    byId("tierFilter").addEventListener("change", function (event) {
      state.tier = event.target.value;
      applyFilters(true);
    });
    byId("statusFilter").addEventListener("change", function (event) {
      state.status = event.target.value;
      applyFilters(true);
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
      if (item) {
        setView("map");
        selectHotel(item.getAttribute("data-hotel-id"), true);
      }
    });
    byId("detailContent").addEventListener("click", function (event) {
      var action = event.target.closest("[data-detail-action]");
      if (!action) return;
      if (action.getAttribute("data-detail-action") === "close") {
        state.selectedHotelId = null;
        renderDetail();
        renderHotelList();
        updateMarkerSelection();
      }
      if (action.getAttribute("data-detail-action") === "save") saveDetail();
    });
    byId("mapViewButton").addEventListener("click", function () { setView("map"); });
    byId("overviewViewButton").addEventListener("click", function () { setView("overview"); });
    byId("mapResetButton").addEventListener("click", resetMapView);
    byId("importButton").addEventListener("click", function () { openModal("importModal"); });
    byId("settingsButton").addEventListener("click", function () {
      updateSourceState();
      openModal("settingsModal");
    });
    byId("exportButton").addEventListener("click", exportCurrent);
    byId("confirmImport").addEventListener("click", confirmImport);
    byId("restoreDemoButton").addEventListener("click", restoreDemo);
    byId("fileInput").addEventListener("change", function (event) { handleFile(event.target.files[0]); });
    document.querySelectorAll("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", function () { closeModal(button.getAttribute("data-close-modal")); });
    });
    document.querySelectorAll(".modal-backdrop").forEach(function (backdrop) {
      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop) closeModal(backdrop.id);
      });
    });

    var dropZone = byId("dropZone");
    ["dragenter", "dragover"].forEach(function (type) {
      dropZone.addEventListener(type, function (event) {
        event.preventDefault();
        dropZone.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (type) {
      dropZone.addEventListener(type, function (event) {
        event.preventDefault();
        dropZone.classList.remove("dragging");
      });
    });
    dropZone.addEventListener("drop", function (event) {
      handleFile(event.dataTransfer.files[0]);
    });

    byId("mobilePanelToggle").addEventListener("click", openMobilePanel);
    byId("closeMobilePanel").addEventListener("click", closeMobilePanel);
    byId("mobileScrim").addEventListener("click", closeMobilePanel);

    document.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        byId("globalSearch").focus();
      }
      if (event.key === "Escape") {
        var openModalNode = document.querySelector(".modal-backdrop:not([hidden])");
        if (openModalNode) closeModal(openModalNode.id);
        else if (byId("detailDrawer").classList.contains("open")) {
          state.selectedHotelId = null;
          renderDetail();
          renderHotelList();
          updateMarkerSelection();
        } else {
          closeMobilePanel();
        }
      }
    });
  }

  async function init() {
    bindEvents();
    renderLegend();
    try {
      var result = await HotelAPI.loadHotels();
      state.hotels = result.data;
      state.source = result.source;
      updateSourceState();
      renderFilterOptions();
      applyFilters(false);
      if (result.warning) toast(result.warning, "error");
    } catch (error) {
      state.hotels = HOTEL_SEED.slice();
      state.source = HOTEL_DATASET.source;
      updateSourceState();
      renderFilterOptions();
      applyFilters(false);
      toast("数据加载失败，已恢复工作台源数据", "error");
    }
    initializeMap();
  }

  document.addEventListener("DOMContentLoaded", init);
}());
