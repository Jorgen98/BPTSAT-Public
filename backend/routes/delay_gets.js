/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

// Súbor s API endpoints pre klientsku aplikáciu

const express = require('express');
const router = express.Router();

const utils = require('./utils');
const db_stop = require('../models/stop');
const db_line = require('../models/line');
const db_route = require('../models/route');
const db_stats = require("../models/stats");
const db_delayRecords = require("../models/delayRecord");
const db_trip = require('../models/trip');
const db_ac_pathNet = require("../models/actualPathsNet");
const db_pathNet = require("../models/pathsNet");

router.use((req, res, next) => {
    next();
});

// Vracia dni, pre ktoré existujú spracované záznamy
router.get('/get_dates', async function (req, res, next) {
    res.json(await get_available_dates());
});

// Vracia dostupné spoje, pre ktoré existujú spracované dáta vo všetkých zvolených dňoch
router.get('/get_available_routes', async function (req, res, next) {
    let params = req.query;
    if (params.valid === undefined) {
        res.json({});
        return;
    }

    let input = params.valid.split(',');

    res.json(await get_available_routes(parse_dates(input)));
});

// Vracia záznamy pre jeden konkrétny spoj v zvolenom časovom rozmedzí
router.get('/get_route', async function (req, res, next) {
    let params = req.query;

    if (params.valid === undefined || params.route_id === undefined || params.trip_id === undefined) {
        res.json({});
        return;
    }

    let input = params.valid.split(',');
    let route_id = parseInt(params.route_id);
    let trip_id = parseInt(params.trip_id);

    if (isNaN(route_id) || isNaN(trip_id)) {
        res.json({});
        return;
    }

    res.json(await get_route(parse_dates(input), route_id, trip_id));
});

// Vracia interné štatistiky spracovaných dát pre konkrétny deň
router.get('/get_stats', async function (req, res, next) {
    let params = req.query;
    if (params.valid === undefined) {
        res.json({});
        return;
    }

    if (isNaN(params.valid)) {
        res.json({});
        return;
    }

    let stat = await db_stats.findOne({'valid': params.valid});

    if (stat === null) {
        res.json({});
        return;
    }

    let count = await db_delayRecords.countDocuments();

    res.json({'stops': stat.stops, 'lines': stat.lines, 'routes': stat.routes, 'trips': stat.trips,
        'trips_to_process': stat.trips_to_process, 'downloaded_trips': stat.downloaded_trips,
        'processed_trips': stat.processed_trips, 'total_processed_trips': count});
});

async function get_available_dates() {
    let dates = await db_stats.find();
    if (dates === null || dates.length === 0) {
        return [];
    }

    // Získame dni, pre ktoré existujú záznamy
    let days = [];
    for (let i = 0; i < dates.length; i++) {
        if (dates[i].processed_trips > 0) {
            days.push(dates[i].valid);
        }
    }
    days.sort();

    if (days.length === 0) {
        return [];
    }

    // Dekódujeme vstupnú požiadavku
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    today = today.valueOf();
    let i = 0;
    while(i < days.length) {
        if (days[i] === today) {
            days.splice(i, 1)
        } else {
            i++;
        }
    }

    if (days.length === 0) {
        return [];
    } else if (days.length === 1) {
        return [days[0].toString()]
    }

    // Zakódujeme výstup
    let result = [];
    let actual = days[0];
    for (let i = 1; i < days.length; i++) {
        if (Math.abs(days[i - 1] - days[i]) !== 24*60*60*1000) {
            if (actual !== days[i - 1]) {
                result.push(actual + '-' + days[i - 1]);
            } else {
                result.push(actual.toString());
            }
            actual = days[i];
        }
    }
    if (actual !== days[days.length - 1]) {
        result.push(actual + '-' + days[days.length - 1]);
    } else {
        result.push(actual.toString());
    }
    return result;
}

// Na základe zvolených dní hľadá spoje, ktorých záznamy existujú pre všetky zvolené dni
async function get_available_routes(valid) {
    let loaded_records, trips = {}, routes = {}, lines = {};

    // Hľadanie spracovaných záznamov
    for (let i = 0; i < valid.length; i++) {
        try {
            loaded_records = await db_delayRecords.find({'valid': valid[i]}, 'trip_id');
        } catch (err) {
            utils.write_to_log(err.message, 'fail');
            return {};
        }

        if (i === 0) {
            for (let j = 0; j < loaded_records.length; j++) {
                trips[loaded_records[j].trip_id] = 1;
            }
        } else {
            for (let j = 0; j < loaded_records.length; j++) {
                trips[loaded_records[j].trip_id] += 1;
            }
        }
    }

    let keys = Object.keys(trips);

    // Hľadanie spojov
    for (let i = 0; i < keys.length; i++) {
        if (trips[keys[i]] !== valid.length) {
            trips[keys[i]] = null;
            continue;
        }
        let trip = await db_trip.findById(keys[i]);
        if (routes[trip.route_id] === undefined) {
            let route = await db_route.findById(trip.route_id, 'stop_ids line_id id');
            if (lines[route.line_id] === undefined) {
                let line = await db_line.findById(route.line_id, 'name type');
                lines[route.line_id] = {'name': line.name, 'type': line.type};
            }
            let from = await db_stop.findById(route.stop_ids[0], 'name');
            let to = await db_stop.findById(route.stop_ids[route.stop_ids.length - 1], 'name');
            routes[trip.route_id] = {'id': route.id, 'line': route.line_id, 'from': from.name,'to': to.name};
        }
        trips[keys[i]] = {'id': trip.id, 'route': trip.route_id, 'dep_time': trip.dep_time};
    }

    let result = {};

    for (let i = 0; i < keys.length; i++) {
        if (trips[keys[i]] === null) {
            continue;
        }
        let trip = trips[keys[i]];
        let route = routes[trip.route];
        let line = lines[route.line];
        if (result[line.name] === undefined) {
            result[line.name] = {'name': line.name, 'type': line.type, 'trips': []};
        }

        result[line.name].trips.push({'trip_id': trip.id, 'route_id': route.id, 'dep_time': trip.dep_time,
            'from': route.from, 'to': route.to})
    }
    return result;
}

// Vracia záznam o konkrétnom spoji vo zvolenom časovom rozsahu
async function get_route(valid, route_id, trip_id) {
    let ac_records, hubs, indexes = [], stops = [], data = [];
    let route = await db_route.findOne({'id': route_id});
    if (route === null) {
        return {};
    }

    let line = await db_line.findById(route.line_id);
    if (line === null) {
        return {};
    }

    let trip = await db_trip.findOne({'id': trip_id});
    if (trip === null) {
        return {};
    }

    try {
        ac_records = await db_ac_pathNet.find();
        if (line.type === 0 || line.type === 2) {
            if (ac_records[0] !== undefined) {
                hubs = await db_pathNet.findById(ac_records[0].rail);
                hubs = hubs.hubs;
            }
        } else {
            if (ac_records[0] !== undefined) {
                hubs = await db_pathNet.findById(ac_records[0].road);
                hubs = hubs.hubs;
            }
        }
    } catch (err) {
        utils.write_to_log(err.message, 'fail');
        return {};
    }

    for (let i = 0; i < route.point_indexes.length; i++) {
        if (route.point_indexes[i] !== -1) {
            indexes.push(hubs[route.point_indexes[i]].p);
        }
    }

    for (let i = 0; i < route.stop_ids.length; i++) {
        let stop = await db_stop.findById(route.stop_ids[i]);
        stops.push({'name': stop.name, 'lat': stop.coords[0],
            'lng': stop.coords[1]});
    }

    // Z každého zvoleného dňa získame záznamy o meškaní
    let record;
    for (let i = 0; i < valid.length; i++) {
        try {
            record = await db_delayRecords.findOne({'trip_id': trip._id, 'valid': valid[i]});
        } catch (err) {
            utils.write_to_log(err.message, 'fail');
            return {};
        }

        if (record === null) {
            return {};
        }

        if (record !== undefined) {
            data.push(record.delays);
        }
    }

    return {'points': indexes, 'stop_indexes': route.stop_indexes, 'stops': stops, 'delays': data};
}

// Pomocná funkcia pre dekódovanie dátumov zo vstupných požiadaviek
function parse_dates(input) {
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    today = today.valueOf();
    let result = [];

    for (let i = 0; i < input.length; i++) {
        if (input[i].split('-').length === 1) {
            let date = parseInt(input[i]);
            if (!isNaN(date) && date < today) {
                result.push(date);
            }
        } else if (input[i].split('-').length === 2) {
            let start = parseInt(input[i].split('-')[0]);
            let end = parseInt(input[i].split('-')[1]);
            if (!isNaN(start) && start < today && !isNaN(end) && end < today && start < end) {
                for (let i = start; i <= end; i+=24*60*60*1000) {
                    result.push(i);
                }
            }
        }
    }
    return result;
}

module.exports = router;