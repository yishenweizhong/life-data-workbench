ObjC.import("Foundation");

const fm = $.NSFileManager.defaultManager;
const cwd = $.NSString.stringWithString($.NSFileManager.defaultManager.currentDirectoryPath).js;
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

if (!fm.fileExistsAtPath(corePath)) {
  fail("Expected core.js to exist and expose HotelCore");
}

const source = $.NSString.stringWithContentsOfFileEncodingError(
  corePath,
  $.NSUTF8StringEncoding,
  null
).js;

eval(source);

if (typeof HotelCore === "undefined") {
  fail("Expected global HotelCore module");
}

const csv = [
  "酒店名称,品牌,区县,地址,经度,纬度,房间数,入住率,平均房价,月GMV,状态,分层",
  '"天津海河假日酒店","洲际","河北区","海河东路,凤凰商贸广场",117.205,39.142,416,82%,620,7800000,正常,A',
  '"天津滨海万丽酒店","万豪","滨海新区","第二大街29号",117.708,39.026,301,0.74,568,5160000,关注,B'
].join("\n");

const parsed = HotelCore.parseHotelCSV(csv);
assertEqual(parsed.errors, [], "valid CSV should not produce errors");
assertEqual(parsed.hotels.length, 2, "CSV should parse both hotel rows");
assertEqual(parsed.hotels[0].name, "天津海河假日酒店", "Chinese column aliases should map to schema");
assertEqual(parsed.hotels[0].address, "海河东路,凤凰商贸广场", "quoted comma should remain in address");
assertEqual(parsed.hotels[0].occupancy, 0.82, "percentage occupancy should normalize to decimal");
assertEqual(parsed.hotels[1].occupancy, 0.74, "decimal occupancy should stay unchanged");

const sourceAlignedCsv = [
  "门店名称,品牌,二级片区,地址,经度,纬度,支付间夜,核销间夜,近7日支付GMV,近7日核销GMV,经营分,近7天变化,金冠认证,POI ID,服务商",
  "维也纳国际酒店(天津站滨江道步行街店),维也纳,津东片区,贵州路16号,117.193424,39.113172,126,40,30138.9,11314.1,95,5,已认证,poi-1,北京昱海黑科技有限公司"
].join("\n");
const sourceAligned = HotelCore.parseHotelCSV(sourceAlignedCsv);
assertEqual(sourceAligned.hotels[0].paymentNights, 126, "source payment nights should map to schema");
assertEqual(sourceAligned.hotels[0].redeemNights, 40, "source redeem nights should map to schema");
assertEqual(sourceAligned.hotels[0].paymentGmv, 30138.9, "source payment GMV should map to schema");
assertEqual(sourceAligned.hotels[0].redeemGmv, 11314.1, "source redeem GMV should map to schema");
assertEqual(sourceAligned.hotels[0].operationScore, 95, "operation score should map to schema");
assertEqual(sourceAligned.hotels[0].scoreDelta, 5, "score delta should map to schema");
assertEqual(sourceAligned.hotels[0].certification, "已认证", "certification should map to schema");
assertEqual(sourceAligned.hotels[0].poiId, "poi-1", "POI id should map to schema");
assertEqual(sourceAligned.hotels[0].provider, "北京昱海黑科技有限公司", "provider should map to schema");
const overRedeemed = HotelCore.normalizeHotel({
  "门店名称": "跨期核销门店",
  "支付间夜": 10,
  "核销间夜": 15,
  "支付增长率": "24.8%",
  "核销增长率": "-3.6%"
}, 1);
assertEqual(overRedeemed.occupancy, 1.5, "cross-period redeem ratio may exceed 100 percent");
assert(Math.abs(overRedeemed.paymentGrowth - 0.248) < 0.000001, "percentage growth should normalize to decimal");
assert(Math.abs(overRedeemed.redeemGrowth + 0.036) < 0.000001, "negative percentage growth should normalize to decimal");

const hotels = [
  { id: "1", name: "天津海河假日酒店", brand: "洲际", district: "河北区", provider: "服务商甲", certification: "已认证", tier: "A", status: "正常", paymentNights: 100, redeemNights: 80, paymentGmv: 62000, redeemGmv: 48000, operationScore: 92, tags: ["海河"] },
  { id: "2", name: "天津滨海万丽酒店", brand: "万豪", district: "滨海新区", provider: "服务商乙", certification: "未认证", tier: "B", status: "关注", paymentNights: 50, redeemNights: 30, paymentGmv: 28400, redeemGmv: 16000, operationScore: 76, tags: ["会展"] },
  { id: "3", name: "天津静海国际酒店", brand: "本地品牌", district: "静海区", provider: "服务商甲", certification: "已认证", tier: "C", status: "风险", paymentNights: 0, redeemNights: 0, paymentGmv: 0, redeemGmv: 0, operationScore: 48, tags: ["待提升"] }
];

const filtered = HotelCore.filterHotels(hotels, {
  query: "海河",
  district: "全部",
  brand: "全部",
  tier: "全部",
  status: "全部"
});
assertEqual(filtered.map((hotel) => hotel.id), ["1"], "query should search name, address and tags");

const districtFiltered = HotelCore.filterHotels(hotels, {
  query: "",
  district: "滨海新区",
  brand: "万豪",
  tier: "B",
  status: "关注"
});
assertEqual(districtFiltered.map((hotel) => hotel.id), ["2"], "filters should combine with AND logic");

const providerFiltered = HotelCore.filterHotels(hotels, {
  query: "",
  district: "全部",
  brand: "全部",
  provider: "服务商甲",
  tier: "全部",
  status: "全部"
});
assertEqual(providerFiltered.map((hotel) => hotel.id), ["1", "3"], "provider filter should hide other providers");

const certificationFiltered = HotelCore.filterHotels(hotels, {
  query: "",
  district: "全部",
  brand: "全部",
  provider: "全部",
  certification: "已认证"
});
assertEqual(certificationFiltered.map((hotel) => hotel.id), ["1", "3"], "certification filter should use the real certification field");

const metrics = HotelCore.aggregateMetrics(hotels);
assertEqual(metrics.hotelCount, 3, "metrics should count hotels");
assertEqual(metrics.paymentNights, 150, "metrics should sum payment nights");
assertEqual(metrics.redeemNights, 110, "metrics should sum redeem nights");
assertEqual(metrics.paymentGmv, 90400, "metrics should sum payment GMV");
assertEqual(metrics.redeemGmv, 64000, "metrics should sum redeem GMV");
assert(Math.abs(metrics.redeemRate - (110 / 150)) < 0.0001, "redeem rate should use total nights");
assert(Math.abs(metrics.adr - (90400 / 150)) < 0.0001, "ADR should use payment GMV divided by payment nights");
assertEqual(metrics.operationScore, 72, "operation score should average all hotels");

const exported = HotelCore.toHotelCSV([parsed.hotels[0]]);
assert(exported.includes('"海河东路,凤凰商贸广场"'), "CSV export should quote comma-containing values");
assert(exported.startsWith("门店名称,品牌,二级片区"), "CSV export should use source-aligned Chinese headers");

console.log("PASS core.test.js");
