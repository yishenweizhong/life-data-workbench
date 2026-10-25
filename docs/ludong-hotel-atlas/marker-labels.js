/* Screen-stable POI names with viewport-aware collision avoidance. */
var HotelMapLabels = (function () {
  "use strict";
  var timer;

  function overlaps(a, b) {
    return a.left < b.right + 4 && a.right > b.left - 4 &&
      a.top < b.bottom + 4 && a.bottom > b.top - 4;
  }

  function layout() {
    var stage = document.getElementById("mapStage");
    if (!stage || stage.hidden) return;
    var bounds = stage.getBoundingClientRect();
    var markers = Array.from(stage.querySelectorAll(
      ".amap-hotel-marker, .fallback-marker"
    )).filter(function (node) {
      return node.getClientRects().length && node.offsetWidth;
    });
    markers.sort(function (a, b) {
      return Number(b.classList.contains("active")) -
        Number(a.classList.contains("active"));
    });
    var icons = markers.map(function (node) {
      var rect = node.querySelector(".hotel-pin-icon").getBoundingClientRect();
      return {
        left: rect.left + 12, right: rect.left + 20,
        top: rect.top + 11, bottom: rect.top + 19
      };
    });
    var occupied = Array.from(document.querySelectorAll(
      ".workspace-toolbar, .map-legend, .map-reset-button, .map-message, .detail-drawer.open"
    )).filter(function (node) {
      return node.getClientRects().length;
    }).map(function (node) { return node.getBoundingClientRect(); });
    var placed = [];

    markers.forEach(function (marker, index) {
      var label = marker.querySelector(".hotel-marker-name");
      if (!label) return;
      label.style.visibility = "hidden";
      label.style.left = "38px";
      label.style.top = "0px";
      var size = label.getBoundingClientRect();
      var width = size.width;
      var height = size.height;
      var positions = [
        [38, 0],
        [-width - 6, 0],
        [16 - width / 2, 47],
        [16 - width / 2, -height - 6]
      ];
      for (var i = 0; i < positions.length; i += 1) {
        label.style.left = positions[i][0] + "px";
        label.style.top = positions[i][1] + "px";
        var rect = label.getBoundingClientRect();
        if (rect.left < bounds.left + 6 || rect.right > bounds.right - 6 ||
            rect.top < bounds.top + 6 || rect.bottom > bounds.bottom - 6) continue;
        if (occupied.some(function (item) { return overlaps(rect, item); })) continue;
        if (placed.some(function (item) { return overlaps(rect, item); })) continue;
        if (!marker.classList.contains("active") && icons.some(function (item, other) {
          return index !== other && overlaps(rect, item);
        })) continue;
        label.style.visibility = "visible";
        placed.push(rect);
        break;
      }
    });
  }

  function refresh() {
    window.clearTimeout(timer);
    timer = window.setTimeout(layout, 60);
  }
  window.addEventListener("resize", refresh);
  return { refresh: refresh };
}());
