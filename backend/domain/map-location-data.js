export const MAPPING_VERSION = 'mapping-v4-national-operational-map';

// BHOOMIDHRISHTI's SIH26017 scope is India. This broad envelope is deliberately
// permissive enough for mainland India plus island territories while rejecting
// impossible/out-of-country coordinates that can silently poison the GIS view.
export const INDIA_BOUNDS = { minLatitude: 6.0, maxLatitude: 38.5, minLongitude: 68.0, maxLongitude: 98.5 };


// Demonstration city/district points used only for synthetic seed records.
// They are deliberately labelled as DEMO_DISTRICT_CENTROID and must never be
// treated as authoritative parcel geometry.
export const DEMO_DISTRICT_POINTS = {
  Salem:[11.6643,78.1460], Chennai:[13.0827,80.2707], Coimbatore:[11.0168,76.9558],
  Madurai:[9.9252,78.1198], Tiruchirappalli:[10.7905,78.7047], Belagavi:[15.8497,74.4977],
  Tumakuru:[13.3392,77.1010], 'Dakshina Kannada':[12.9141,74.8560], Guntur:[16.3067,80.4365],
  Visakhapatnam:[17.6868,83.2185], Warangal:[17.9689,79.5941], Nizamabad:[18.6725,78.0941],
  Nashik:[19.9975,73.7898], Nagpur:[21.1458,79.0882], Pune:[18.5204,73.8567], Vadodara:[22.3072,73.1812],
  Rajkot:[22.3039,70.8022], Jodhpur:[26.2389,73.0243], Kota:[25.2138,75.8648], Varanasi:[25.3176,82.9739],
  Meerut:[28.9845,77.7064], Sambalpur:[21.4669,83.9756], Cuttack:[20.4625,85.8830], Gaya:[24.7914,85.0002],
  Patna:[25.5941,85.1376], Gorakhpur:[26.7606,83.3732], Lucknow:[26.8467,80.9462], Ayodhya:[26.7997,82.2043],
  Rajahmundry:[17.0005,81.8040], Vijayawada:[16.5062,80.6480], Mangaluru:[12.9141,74.8560],
  Krishnagiri:[12.5186,78.2137], Gopalganj:[26.4672,84.4404], 'Bengaluru Rural':[13.2257,77.5750],
  Malda:[25.0108,88.1411], Indore:[22.7196,75.8577], Bhopal:[23.2599,77.4126],
  Bengaluru:[12.9716,77.5946], Kurnool:[15.8281,78.0373], Nellore:[14.4426,79.9865],
};

export function demoPointForDistrict(district='') {
  const key=String(district||'').trim();
  const pair=DEMO_DISTRICT_POINTS[key];
  return pair ? {latitude:pair[0], longitude:pair[1], precision:'DISTRICT_CENTROID', source:'DEMO_DISTRICT_CENTROID', label:`${key} demonstration district point`} : null;
}

// State-level fallback used only when a project has a valid state but no project/district
// coordinate. This keeps newly-created records visible in GIS without pretending the
// point is parcel geometry. It is deliberately labelled approximate and can be replaced
// later by an authorised project coordinate or source geometry.
export const DEMO_STATE_POINTS = {
  'Tamil Nadu':[11.1271,78.6569], 'Karnataka':[15.3173,75.7139], 'Andhra Pradesh':[15.9129,79.7400],
  'Telangana':[18.1124,79.0193], 'Maharashtra':[19.7515,75.7139], 'Gujarat':[22.2587,71.1924],
  'Rajasthan':[27.0238,74.2179], 'Uttar Pradesh':[26.8467,80.9462], 'Odisha':[20.9517,85.0985],
  'Bihar':[25.0961,85.3131], 'West Bengal':[22.9868,87.8550], 'Kerala':[10.8505,76.2711],
  'Madhya Pradesh':[22.9734,78.6569], 'Punjab':[31.1471,75.3412], 'Haryana':[29.0588,76.0856],
  'Delhi':[28.6139,77.2090], 'Chhattisgarh':[21.2787,81.8661], 'Jharkhand':[23.6102,85.2799],
  'Assam':[26.2006,92.9376], 'Uttarakhand':[30.0668,79.0193], 'Himachal Pradesh':[31.1048,77.1734],
  'Goa':[15.2993,74.1240], 'Jammu and Kashmir':[33.7782,76.5762], 'Jammu & Kashmir':[33.7782,76.5762],
  'Ladakh':[34.1526,77.5770], 'Manipur':[24.6637,93.9063], 'Meghalaya':[25.4670,91.3662],
  'Mizoram':[23.1645,92.9376], 'Nagaland':[26.1584,94.5624], 'Tripura':[23.9408,91.9882],
  'Sikkim':[27.5330,88.5122], 'Arunachal Pradesh':[28.2180,94.7278],
};
export function demoPointForState(state='') {
  const key=String(state||'').trim();
  const pair=DEMO_STATE_POINTS[key];
  return pair ? {latitude:pair[0], longitude:pair[1], precision:'STATE_CENTROID', source:'DEMO_STATE_CENTROID', label:`${key} demonstration state point; approximate only`} : null;
}

export function coordinatePairValid(latitude, longitude) {
  const lat=Number(latitude), lon=Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat>=-90 && lat<=90 && lon>=-180 && lon<=180;
}

export function indiaCoordinateValid(latitude, longitude) {
  const lat=Number(latitude), lon=Number(longitude);
  return coordinatePairValid(lat, lon) && lat>=INDIA_BOUNDS.minLatitude && lat<=INDIA_BOUNDS.maxLatitude && lon>=INDIA_BOUNDS.minLongitude && lon<=INDIA_BOUNDS.maxLongitude;
}
