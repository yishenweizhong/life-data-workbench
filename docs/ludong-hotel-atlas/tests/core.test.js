ObjC.import("Foundation");

const fm = $.NSFileManager.defaultManager;
const cwd = $.NSString.stringWithString(
  $.NSFileManager.defaultManager.currentDirectoryPath
).js;
const corePath = `${cwd}/core.js`;

function fail(message) {
  throw new Error(message);
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail(`${message}\nexpected: ${e}\nactual:   ${a}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

if (!fm.fileExistsAtPath(corePath)) fail("Expected core.js");
const source = $.NSString.stringWithContentsOfFileEncodingError(
  corePath,
  $.NSUTF8StringEncoding,
  null
).js;
eval(source);

const hotels = [
  {
    id: "1", name: "青岛海景酒店", brand: "品牌甲",
    district: "青岛前海片区", city: "青岛市", provider: "服务商甲",
    certification: "已认证", paymentNights: 100, redeemNights: 80,
    paymentGmv: 62000, redeemGmv: 48000, operationScore: 92,
    tags: ["海景"]
  },
  {
    id: "2", name: "烟台中心酒店", brand: "品牌乙",
    district: "烟台片区", city: "烟台市", provider: "服务商乙",
    certification: "未认证", paymentNights: 50, redeemNights: 30,
    paymentGmv: 28400, redeemGmv: 16000, operationScore: 76,
    tags: []
  },
  {
    id: "3", name: "临沂待补门店", brand: "品牌甲",
    district: "临沂片区", city: "临沂市", provider: "未绑定服务商",
    certification: "暂缺", paymentNights: 0, redeemNights: 0,
    paymentGmv: 0, redeemGmv: 0, operationScore: null,
    tags: []
  }
];

assertEqual(
  HotelCore.filterHotels(hotels, {
    query: "", district: "全部", city: "青岛市", brand: "全部",
    provider: "服务商甲", certification: "已认证",
    scoreAvailability: "有经营分"
  }).map((hotel) => hotel.id),
  ["1"],
  "six filters should combine with AND logic"
);

assertEqual(
  HotelCore.filterHotels(hotels, {
    query: "", district: "全部", city: "全部", brand: "全部",
    provider: "全部", certification: "全部",
    scoreAvailability: "经营分暂缺"
  }).map((hotel) => hotel.id),
  ["3"],
  "score availability should expose missing scores"
);

assertEqual(
  HotelCore.filterHotels(hotels, {
    query: "临沂", district: "临沂片区", city: "临沂市",
    brand: "品牌甲", provider: "未绑定服务商",
    certification: "暂缺", scoreAvailability: "经营分暂缺"
  }).map((hotel) => hotel.id),
  ["3"],
  "query and every Ludong filter should combine"
);

const metrics = HotelCore.aggregateMetrics(hotels);
assertEqual(metrics.hotelCount, 3, "metrics should count all hotels");
assertEqual(metrics.scoredHotelCount, 2, "metrics should count scored hotels");
assertEqual(metrics.operationScore, 84, "missing scores must not enter average");

const exported = HotelCore.toHotelCSV([hotels[2]]);
assert(
  exported.includes("临沂待补门店") && !exported.includes("null"),
  "missing score should stay blank in CSV"
);

console.log("PASS core.test.js");
