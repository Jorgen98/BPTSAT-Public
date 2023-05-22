/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const express = require('express');
const router = express.Router();

const utils = require('./utils');
const db_stop = require('../models/stop');
const db_line = require('../models/line');
const db_route = require('../models/route');
const db_trip = require('../models/trip');
const db_ac_pathNet = require("../models/actualPathsNet");
const db_pathNet = require("../models/pathsNet");
const db_delayRecords = require("../models/delayRecord");
const db_stats = require("../models/stats");

// DOLEŽITÁ POZNÁMKA
// Formát GTFS je premenlivá štruktúra, preto je jeho ukladanie komplikované
// Vzhľadom na to budú v DB existovať v čase rôzne verzie zastávok, liniek a trás
// Aby sa predišlo duplicite, sú ukladané iba zmeny v rámci súborov GTFS
// Preto je dôležitý dátum, pre ktorý chceme dáta získať
// Pre daný dátum môže dochádzať ku kombinácií platnosti, kedy napr. verzia zastávky je platná už 2 mesiace,
// verzia linky je platná 2 týždne a verzia trasy sa naposledy zmenila pred 2 dňami
// Vrátený je tak stav platný pre daný deň, ale jednotlivé elementy do DB nemuseli vstupovať v rovnaký deň

router.use((req, res, next) => {
    next();
});

// Endpoint vracajúci najstarší dátum platnosti trasy
// Slúži na určenie, od kedy do dneška má zmysel si z DB pýtať dáta
router.get('/get_date', async function (req, res, next) {
    res.json(await get_oldest_date());
});

// Endpoint, ktorý vráti linky a im prislúchajúce trasy platné pre zvolený deň
router.get('/get_available_routes', async function (req, res, next) {
    let params = req.query;

    if (params.valid === undefined) {
        res.json({});
        return;
    }

    // Overenie parametrov
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let valid = parseInt(params.valid);
    if (isNaN(valid) || valid < 0) {
        res.json({});
        return -1;
    }

    res.json(await get_available_routes(valid));
});

// Endpoint vracajúci kompletnú trasu platnú v určitom časovom okamihu
router.get('/get_route', async function (req, res, next) {
    let params = req.query;

    if (params.code === undefined) {
        res.json({});
        return;
    }

    // Overenie parametrov
    let code = parseInt(params.code);
    if (isNaN(code)) {
        res.json({});
        return -1;
    }

    res.json(await get_route(code));
});

// Funkcia, ktorá vráti časovú značku najstaršieho záznamu trasy v DB
async function get_oldest_date() {
    let dates = await db_stats.find();

    if (dates === null || dates.length === 0) {
        return [];
    }

    for (let i = 0; i < dates.length; i++) {
        if (dates[i].processed_trips > 0) {
            return dates[i].valid;
        }
    }

    return [];
}

// Funkcia vracajúca trasu z DB platnú v istý deň
async function get_route(code) {
    let ac_records = {};
    let route = await db_route.findOne({'id': code});
    if (route === null) {
        return {};
    }

    let line = await db_line.findById(route.line_id);
    if (line === null) {
        return {};
    }

    let hubs = [], indexes = [], stops = [];

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

    // Získame skutočné uzly na trase
    for (let i = 0; i < route.point_indexes.length; i++) {
        if (route.point_indexes[i] !== -1) {
            indexes.push(hubs[route.point_indexes[i]].p);
        }
    }

    // Získame polohy zastávok a ich názvy na trase
    for (let i = 0; i < route.stop_ids.length; i++) {
        let stop = await db_stop.findById(route.stop_ids[i]);
        stops.push({'name': stop.name, 'lat': stop.coords[0],
            'lng': stop.coords[1]});
    }

    // Vrátime kompletnú trasu
    return {'points': indexes, 'stop_indexes': route.stop_indexes, 'stops': stops};
}

// Funkcia, ktorá vráti trasy z DB platné v daný deň
async function get_available_routes(valid) {
    // Získame trasy platné v daný deň
    let records = await db_delayRecords.find({'valid': valid}, 'trip_id');

    if (records === null || records.length === 0) {
        return [];
    }

    let trips = [];
    for (let i = 0; i < records.length; i++) {
        if (trips.indexOf(records[i].trip_id)) {
            trips.push(records[i].trip_id);
        }
    }

    trips = await db_trip.find({
        '_id': { $in: trips}
    }, 'route_id');
    if (trips === null) {
        return [];
    }

    let routes = [];
    for (let i = 0; i < trips.length; i++) {
        if (routes.indexOf(trips[i].route_id)) {
            routes.push(trips[i].route_id);
        }
    }

    routes = await db_route.find({
        '_id': { $in: routes}
    });
    if (routes === null) {
        return [];
    }

    let temp_result = {}, result = [];

    // Trasy zoskupíme podľa liniek
    for (let i = 0; i < routes.length; i++) {
        let route = await db_route.findById(routes[i]);

        if (temp_result[route.line_id] === undefined) {
            temp_result[route.line_id] = [{'code': route.id, 'from': route.stop_ids[0],
                    'to': route.stop_ids[route.stop_ids.length - 1]}];
        } else {
            temp_result[route.line_id].push({'code': route.id, 'from': route.stop_ids[0],
                'to': route.stop_ids[route.stop_ids.length - 1]});
        }
    }

    let keys = Object.keys(temp_result);
    for (let i = 0; i < keys.length; i++) {
        let line = await db_line.findById(keys[i]);
        let temp_routes = temp_result[keys[i]];

        for (let j = 0; j < temp_routes.length; j++) {
            let from = await db_stop.findById(temp_routes[j].from);
            let to = await db_stop.findById(temp_routes[j].to);

            temp_routes[j] = {'code': temp_routes[j].code, 'from': from.name, 'to': to.name};
        }

        result.push({'name': line.name, 'routes': temp_routes});
    }

    return result;
}

module.exports = router;