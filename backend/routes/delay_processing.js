/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

/*
 * Hlavný súbor pre spracovanie záznamov o meškaní
 * Prvým krokom je príprava KORDIS id pre spoje, ktoré majú premávať spolu s ich trasami.
 * Následne sú sťahované záznamy pre jednotlivé linky a tieto záznamy sú spracované.
 */

const request = require('request');

const utils = require('./utils');
const db_line = require('../models/line');
const db_route = require('../models/route');
const db_api = require("../models/api");
const db_trip = require("../models/trip");
const db_pathNet = require("../models/pathsNet");
const db_ac_pathNet = require("../models/actualPathsNet");
const db_stats = require("../models/stats");
const db_delayRecord = require("../models/delayRecord");

const GIS_WEB_START = 'https://gis.brno.cz/ags1/rest/services/Hosted/ODAE_public_transit_positional_feature_service/FeatureServer/0/query?f=json&where=(';
const GIS_WEB_END = ')&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=102100&resultOffset=0&resultRecordCount=10000';

let DB_trips = {};
let date_val;
let routes = {};
let num_of_trips_in_db = 0;
let num_of_saved_trips = 0;

// Riadiaca funkcia
async function process_data() {
    utils.write_to_log('Delay data processing has started', 'proc');
    date_val = new Date();
    date_val.setHours(0, 0, 0, 0);
    date_val = new Date(date_val.valueOf() - 24*60*60*1000);

    let stats = await db_stats.findOne({'valid': date_val.valueOf()});

    if (stats === null || stats.downloaded_trips > 0) {
        utils.write_to_log('Delay data has been already processed', 'proc');
        return;
    }

    // Príprava trás a id spojov pre spracovávaný deň
    if (await get_trips() === -1) {
        return;
    }
    await db_delayRecord.deleteMany({'valid': date_val});
    utils.write_to_log('Trips from DB loaded successfully', 'proc');

    // Spracovanie záznamov po linkách
    let keys = Object.keys(DB_trips);
    let show_progress = utils.progress_log('Delay data', keys.length);
    show_progress.start();
    for (let i = 0; i < keys.length; i++) {
        await process_line(keys[i], DB_trips[keys[i]], show_progress, i);
    }

    utils.write_to_log('Stats: Number of trips: ' + num_of_trips_in_db, 'proc');
    utils.write_to_log('Stats: Number of processed trips: ' + num_of_saved_trips, 'proc');
    show_progress.finish();

    await db_stats.findOneAndUpdate({'valid': date_val.valueOf()}, {'$set': {'downloaded_trips': num_of_trips_in_db,
            'processed_trips': num_of_saved_trips}});
}

// Príprava spojov a trás, ktoré mali byť daný deň vykonané
async function get_trips() {
    let ac_trips = await db_api.find();
    let keys = Object.keys(ac_trips);
    let ac_records, rail_hubs, road_hubs;
    DB_trips = {};
    routes = {};

    if (ac_trips.length === 0) {
        utils.write_to_log('No trips available for current processing date', 'fail');
        return -1;
    }

    // Načítanie spojov
    for (let i = 0; i < keys.length; i++) {
        let trip = await db_trip.findById(ac_trips[keys[i]].trip_id);
        let id = trip.code.split('/')[1];
        id = id.split('D')[0];
        id = id.substring(1);

        routes[trip.route_id] = null;
        if (DB_trips[id] === undefined) {
            DB_trips[id] = {};
        }
        DB_trips[id][ac_trips[keys[i]].api_code] = {'trip_id': ac_trips[keys[i]].trip_id, 'route_id': trip.route_id};
    }

    try {
        ac_records = await db_ac_pathNet.find();
        if (ac_records[0] !== undefined) {
            rail_hubs = await db_pathNet.findById(ac_records[0].rail);
            rail_hubs = rail_hubs.hubs;
        } else {
            return;
        }
        if (ac_records[0] !== undefined) {
            road_hubs = await db_pathNet.findById(ac_records[0].road);
            road_hubs = road_hubs.hubs;
        } else {
            return;
        }
    } catch (err) {
        utils.write_to_log(err.message, 'fail');
        return -1;
    }

    keys = Object.keys(routes);

    // Príprava trás
    for (let i = 0; i < keys.length; i++) {
        let route = await db_route.findById(keys[i]);
        let line = await db_line.findById(route.line_id, 'type');
        let points = [];

        for (let j = 0; j < route.point_indexes.length; j++) {
            if (route.point_indexes[j] !== -1) {
                if (line.type === 0 || line.type === 2) {
                    points.push(rail_hubs[route.point_indexes[j]].p);
                } else {
                    points.push(road_hubs[route.point_indexes[j]].p);
                }
            }
        }
        if (points.length > 0) {
            routes[keys[i]] = points;
        } else {
            delete routes[keys[i]];
        }
    }
}

// Spracovanie všetkých záznamov pre jednu linku
async function process_line(line, trips, prog, val) {
    utils.write_to_log('Start processing line L' + line + 'D99', 'proc');

    return new Promise(function(resolve, reject) {
        // Sťahovanie záznamov
        get_delay_data(0, line, 0).then((data) => {
            let processed_data = {};
            // Zoskupenie záznamov po spojoch
            for (let i = 0; i < data.length; i++) {
                if (processed_data[data[i].attributes.routeid] === undefined) {
                    processed_data[data[i].attributes.routeid] = {'course': data[i].attributes.course,
                        'finalstop': data[i].attributes.finalstopid, 'data': [{'delay': data[i].attributes.delay,
                            'p': [data[i].attributes.lat, data[i].attributes.lng]}]};
                } else {
                    if (processed_data[data[i].attributes.routeid].course === data[i].attributes.course &&
                        processed_data[data[i].attributes.routeid].finalstop === data[i].attributes.finalstopid) {
                        processed_data[data[i].attributes.routeid].data.push({'delay': data[i].attributes.delay,
                            'p': [data[i].attributes.lat, data[i].attributes.lng]})
                    }
                }
            }

            // Spracovanie záznamov
            let keys = Object.keys(processed_data);
            utils.write_to_log('Downloading delay data for line L' + line +
                'D99 has finished, processing ' + keys.length + ' trips', 'proc');
            num_of_trips_in_db += keys.length;
            let promises = [];
            for (let j = 0; j < keys.length; j++) {
                if (trips[keys[j]] !== undefined) {
                    if (routes[trips[keys[j]].route_id] !== undefined) {
                        promises.push(process_one_trip(processed_data[keys[j]].data, trips[keys[j]]));
                    }
                }
            }
            Promise.all(promises);
            resolve();
            utils.write_to_log('Processing delay data for line L' + line + 'D99 has finished', 'proc')
            prog.actualise(val);
        })
    });
}

// Vlastné spracovanie sady záznamov jedného spoja
async function process_one_trip(data, trip) {
    return new Promise(async function (resolve, reject) {
        let point_indexes = routes[trip.route_id];
        let delays = Array(point_indexes.length - 1).fill(null);
        for (let i = 0; i < data.length; i++) {
            let score = Infinity, best_score = Infinity;
            for (let j = 0; j < (point_indexes.length - 1); j++) {
                score = triangulation(data[i].p, point_indexes[j], point_indexes[j + 1]);
                if (score !== Infinity) {
                    if (score < best_score) {
                        best_score = score;
                        delays[j] = data[i].delay;
                    }
                }
            }
        }

        let new_record = new db_delayRecord({
            'delays': delays, 'trip_id': trip.trip_id, 'valid': date_val});
        num_of_saved_trips += 1;
        await new_record.save();
        resolve();
    });
}

// Funkcia pre sťahovanie záznamov z externej db mesta Brna
async function get_delay_data(object_id, line_id, iter) {
    const start_time = new Date(date_val.valueOf());
    const end_time = new Date(date_val.valueOf() + 60*60*1000*26);
    let GIS_WEB_PARAMS = '"lastupdate">' + start_time.valueOf() + ' AND "lineid"=' + line_id +
        ' AND "lastupdate"<' + end_time.valueOf() + ' AND objectid>';

    return new Promise(function(resolve, reject) {
        request(GIS_WEB_START + GIS_WEB_PARAMS + object_id + GIS_WEB_END, { json: true }, (err, res, body) => {
            if (err) {
                utils.write_to_log(err, 'fail');
                utils.write_to_log('Trying to get data again', 'proc')
                if (iter > 5) {
                    resolve([]);
                    utils.write_to_log('Downloading data has failed', 'fail');
                } else {
                    get_delay_data(object_id, line_id, iter + 1).then((data)=>{
                        resolve(data);
                    });
                }
            } else {
                let data = body.features;
                if (data === undefined || data.length > 0) {
                    get_delay_data(data[data.length - 1].attributes.objectid, line_id, 0).then((inner)=>{
                        data = data.concat(inner);
                        resolve(data);
                    })
                } else {
                    resolve([]);
                }
            }
        })
    });
}

// Výpočet uhla medzi troma bodmi
function triangulation(geo_hub_a, geo_hub_b, geo_point) {
    let angle_CAB = get_angle(geo_point, geo_hub_a, geo_hub_b);
    let angle_CBA = get_angle(geo_point, geo_hub_b, geo_hub_a);

    if (angle_CAB > 1.61 && angle_CBA > 1.61) {
        return Infinity;
    } else if (angle_CAB > 1.61) {
        return Math.sin(angle_CBA) * count_distance(geo_point, geo_hub_b);
    } else if (angle_CBA > 1.61) {
        return Math.sin(angle_CAB) * count_distance(geo_point, geo_hub_a);
    } else {
        return Math.min(Math.sin(angle_CAB) * count_distance(geo_point, geo_hub_a), Math.sin(angle_CBA) * count_distance(geo_point, geo_hub_b));
    }
}

// Výpočet vzdialenosti medzi dvoma bodmi
function count_distance(point_a, point_b) {
    // Výpočet vzdialenosti pomocou Haversine formuly
    // Prevzaté z https://www.movable-type.co.uk/scripts/latlong.html
    const R = 6371e3;
    let lat_1_rad = point_a[0] * Math.PI / 180;
    let lat_2_rad = point_b[0] * Math.PI / 180;
    let delta_1 = (point_b[0]- point_a[0]) * Math.PI / 180;
    let delta_2 = (point_b[1]-point_a[1]) * Math.PI / 180;

    let a = Math.sin(delta_1 / 2) * Math.sin(delta_1 / 2) + Math.cos(lat_1_rad) * Math.cos(lat_2_rad) *
        Math.sin(delta_2 / 2) * Math.sin(delta_2 / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return(R * c);
}

function get_angle(x, y, z) {
    let x_y = Math.sqrt(Math.pow(y[0] - x[0], 2)+ Math.pow(y[1] - x[1], 2));
    let y_z = Math.sqrt(Math.pow(y[0] - z[0], 2)+ Math.pow(y[1] - z[1], 2));
    let x_z = Math.sqrt(Math.pow(z[0] - x[0], 2)+ Math.pow(z[1] - x[1], 2));

    return Math.acos((y_z * y_z + x_y * x_y - x_z * x_z) / (2 * y_z * x_y));
}

module.exports = {process_data};