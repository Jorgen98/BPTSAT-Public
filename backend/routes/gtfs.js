/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

// Funkcie pre aktualizáciu modelu dopravného systému

const request = require('request');
const fs = require('fs');
const decompress = require("decompress");

const utils = require('./utils');
const db_stop = require('../models/stop');
const db_ac_stops = require('../models/actualStop');
const db_line = require('../models/line');
const db_ac_lines = require('../models/actualLine');
const db_route = require('../models/route');
const db_ac_routes = require('../models/actualRoute');
const db_pathNet = require("../models/pathsNet");
const db_ac_pathNet = require("../models/actualPathsNet");
const db_trip = require("../models/trip");
const db_ac_trips = require("../models/actualTrip");
const routing = require('./routing');
const db_api = require("../models/api");
const db_stats = require("../models/stats");

const gtfs_file_url = 'https://mestobrno.maps.arcgis.com/sharing/rest/content/items/379d2e9a7907460c8ca7fda1f3e84328/data';
const fn_zip = './static_files/gtfs_input.zip';
const fn_stops = 'stops.txt';
const fn_lines = 'routes.txt';
const fn_routes = 'trips.txt';
const fn_trips = 'stop_times.txt';
const fn_api = 'api.txt';
const fn_calendar = 'calendar.txt';
const fn_exceptions = 'calendar_dates.txt';

let trips = {};
let routes_to_route = [];
let api = {};
let services = [];
let stats = {'stops': 0, 'lines': 0, 'routes': 0, 'trips': 0, 'trips_to_process': 0, 'downloaded_trips': 0,
    'processed_trips': 0, 'valid': 0};

// Riadiaca funkcia
async function actualise_GTFS_data() {
    utils.write_to_log('Data update has started', 'gtfs');

    let date = new Date();
    date.setHours(0, 0, 0, 0);

    let stats = await db_stats.findOne({'valid': date.valueOf()});

    if (stats !== null) {
        utils.write_to_log('Data has been already updated', 'gtfs');
        return;
    }

    // Celá aktualizácia závisí od externého súboru z data.brno
    await request(gtfs_file_url)
        .pipe(fs.createWriteStream(fn_zip))
        .on('open', function () {
            utils.write_to_log('Downloading file from mestobrno.maps.arcgis.com', 'gtfs');
        })
        .on('close', function () {
            utils.write_to_log('Input file successfully downloaded', 'gtfs');
            process_zip_file();
        })
        .on('uncaughtException', function (err) {
            utils.write_to_log(err.message, 'fail');
        })
}

// Spracovanie súboru
function process_zip_file() {
    try {
        if (fs.existsSync(fn_zip)) {
            decompress(fn_zip, "dist")
                .then(async (files) => {
                    let stops_file = undefined;
                    let lines_file = undefined;
                    let routes_file = undefined;
                    let trips_file = undefined;
                    let api_file = undefined;
                    let calendar_file = undefined;
                    let exception_file = undefined;
                    trips = {};
                    api = {};
                    services = [];
                    stats = {'stops': 0, 'lines': 0, 'routes': 0, 'trips': 0, 'trips_to_process': 0, 'downloaded_trips': 0,
                        'processed_trips': 0, 'valid': 0};

                    for (let i = 0; i < files.length; i++) {
                        if (files[i].path === fn_stops) {
                            stops_file = files[i];
                        } else if (files[i].path === fn_lines) {
                            lines_file = files[i];
                        } else if (files[i].path === fn_routes) {
                            routes_file = files[i];
                        } else if (files[i].path === fn_trips) {
                            trips_file = files[i];
                        } else if (files[i].path === fn_api) {
                            api_file = files[i];
                        } else if (files[i].path === fn_calendar) {
                            calendar_file = files[i];
                        } else if (files[i].path === fn_exceptions) {
                            exception_file = files[i];
                        }
                    }

                    // Aktualizácia zastávok v DB
                    await process_file(stops_file, 0).then(
                        () => utils.write_to_log('Stops data processing finish successfully', 'gtfs'));
                    // Aktualizácia liniek v DB
                    await process_file(lines_file, 1).then(
                        () => utils.write_to_log('Lines data processing finish successfully', 'gtfs'));
                    // Aktualizácia trás v DB
                    preprocess_trips(trips_file);
                    await process_file(routes_file, 2).then(
                        () => utils.write_to_log('Routes data processing finish successfully', 'gtfs'));
                    // Po aktualizácií dát je pre nové trasy v DB spustený routing
                    await apply_routing().then(
                        () => utils.write_to_log('Routing is done', 'gtfs'));
                    preprocess_apis(api_file);
                    await preprocess_services_file(calendar_file, exception_file);
                    // Aktualizácia dát o tripoch, vykonávaných v daný deň
                    await process_file(routes_file, 3).then(
                        () => utils.write_to_log('Trip data processing finish successfully', 'gtfs'));
                    let date = new Date();
                    date.setHours(0, 0, 0, 0);
                    stats.valid = date.valueOf();
                    let new_stat_record = new db_stats(stats);
                    await new_stat_record.save();
                    utils.write_to_log('GTFS data actualisation finished successfully', 'gtfs')
                })
                .catch((err) => {
                    utils.write_to_log(err.message, 'fail');
                    return -1;
                });
        }
    } catch(err) {
        utils.write_to_log(err.message, 'fail');
        return -1;
    }
}

// Funkcia riadiaca aktualizáciu GTFS súborov
async function process_file(file, type) {
    let input = file.data.toString().split('\n');
    input.shift();
    routes_to_route = [];
    let ac_records, ac_objects = {}, ac_indexes = [];
    let ac_stops = {}, ac_lines = {}, ac_routes = {};

    // Získame aktuálne verzie objektov z DB
    try {
        if (type === 0) {
            ac_records = await db_ac_stops.find();
            if (ac_records[0] !== undefined) {
                ac_records = await db_stop.find({
                    '_id': { $in: ac_records[0].stops}
                })
                for (let i = 0; i < ac_records.length; i++) {
                    ac_objects[ac_records[i].stop_id] = {'name': ac_records[i].name,
                        'coords': ac_records[i].coords, 'id': ac_records[i]._id}
                }
            }
            utils.write_to_log('Loaded actual stops data from DB', 'gtfs')
        } else if (type === 1) {
            ac_records = await db_ac_lines.find();
            if (ac_records[0] !== undefined) {
                ac_records = await db_line.find({
                    '_id': { $in: ac_records[0].lines}
                })
                for (let i = 0; i < ac_records.length; i++) {
                    ac_objects[ac_records[i].line_id] = {'name': ac_records[i].name,
                        'type': ac_records[i].type, 'color': ac_records[i].color, 'id': ac_records[i]._id}
                }
            }
            utils.write_to_log('Loaded actual lines data from DB', 'gtfs')
        } else if (type === 2) {
            ac_records = await db_ac_routes.find();
            if (ac_records[0] !== undefined) {
                ac_records = await db_route.find({
                    '_id': { $in: ac_records[0].routes}
                }, 'code line_id stop_ids');
                for (let i = 0; i < ac_records.length; i++) {
                    ac_objects[ac_records[i].code] = {'line_id': ac_records[i].line_id,
                        'stop_ids': ac_records[i].stop_ids, 'id': ac_records[i]._id};
                }
            }

            ac_records = await db_ac_stops.find();
            if (ac_records[0] !== undefined) {
                ac_records = await db_stop.find({
                    '_id': { $in: ac_records[0].stops}
                }, 'stop_id');
                for (let i = 0; i < ac_records.length; i++) {
                    ac_stops[ac_records[i].stop_id] = ac_records[i]._id;
                }
            }

            ac_records = await db_ac_lines.find();
            if (ac_records[0] !== undefined) {
                ac_records = await db_line.find({
                    '_id': { $in: ac_records[0].lines}
                }, 'line_id');
                for (let i = 0; i < ac_records.length; i++) {
                    ac_lines[ac_records[i].line_id] = ac_records[i]._id;
                }
            }
            utils.write_to_log('Loaded actual routes data from DB', 'gtfs');
        } else if (type === 3) {
            ac_records = await db_ac_routes.find();
            if (ac_records[0] !== undefined) {
                ac_records = await db_route.find({
                    '_id': { $in: ac_records[0].routes}
                }, 'code');
                for (let i = 0; i < ac_records.length; i++) {
                    ac_routes[ac_records[i].code] = ac_records[i]._id;
                }
            }

            ac_records = await db_ac_trips.find();
            if (ac_records[0] !== undefined) {
                ac_records = await db_trip.find({
                    '_id': { $in: ac_records[0].trips}
                });
                for (let i = 0; i < ac_records.length; i++) {
                    ac_objects[ac_records[i].code] = {'route_id': ac_records[i].route_id, 'id': ac_records[i]._id};
                }
            }
            await db_api.deleteMany({});
            utils.write_to_log('Loaded actual trip data from DB', 'gtfs')
        } else {
            return -1;
        }
    }
    catch(err) {
        utils.write_to_log(err.message, 'fail');
        return -1;
    }

    utils.write_to_log('Finding and saving differences', 'gtfs');

    // Prechádzame aktuálny GTFS súbor a hľadáme objekty, ktoré sa odlišujú od najnovšej verzie danej zastávky v DB
    for (let i = 0; i < input.length; i++) {
        // Parsovanie parametrov z .txt súboru
        input[i] = input[i].replace(/"/g, '').split(',');
        let line_len = input[i].length;

        let code = input[i][0];
        let name = '';
        let lat, lng;
        let r_type, color;
        let service_id;

        if (type === 0) {
            if (line_len < 9) {
                continue;
            }

            name = input[i][1];
            for (let j = 2; j < line_len - 7; j++) {
                name = name + ', ' + input[i][j];
            }

            lat = parseFloat(input[i][line_len - 7]);
            lng = parseFloat(input[i][line_len - 6]);

            if (ac_objects[code] === undefined) {
                let new_stop = new db_stop({'stop_id': code, 'name': name, 'coords': [lat, lng]});
                ac_indexes.push(await new_stop.save());
            } else {
                if (ac_objects[code].name === name && ac_objects[code].coords[0] === lat && ac_objects[code].coords[1] === lng) {
                    ac_indexes.push(ac_objects[code].id);
                } else {
                    let new_stop = new db_stop({'stop_id': code, 'name': name, 'coords': [lat, lng]});
                    ac_indexes.push(await new_stop.save());
                }
            }
        } else if (type === 1) {
            if (line_len < 7) {
                continue;
            }

            name = input[i][2];

            r_type = parseInt(input[i][line_len - 3]);
            color = input[i][line_len - 2];

            if (r_type !== 0 && r_type !== 2 && r_type !== 800) {
                if (r_type !== 3) {
                     continue;
                }
                if (name[0] !== 'N' && name[0] !== 'š') {
                     if (parseInt(name) > 100 || name[0] === 'x' || name[0] === 'X') {
                          continue;
                     }
                }
            }

            if (color === '') {
                color = 'FFFFFF';
            }

            if (ac_objects[code] === undefined) {
                let new_line = new db_line({'line_id': code, 'name': name, 'type': r_type, 'color': color});
                ac_indexes.push(await new_line.save());
            } else {
                if (ac_objects[code].name === name && ac_objects[code].type === r_type && ac_objects[code].color === color) {
                    ac_indexes.push(ac_objects[code].id);
                } else {
                    let new_line = new db_line({'line_id': code, 'name': name, 'type': r_type, 'color': color});
                    ac_indexes.push(await new_line.save());
                }
            }
        } else if (type === 2) {
            if (line_len < 8) {
                continue;
            }

            name = input[i][0];
            code = input[i][2];

            let route_code = name + '/' + trips[code].stops.toString();

            if (ac_lines[name] === undefined) {
                continue;
            }

            if (ac_objects[route_code] === undefined) {
                let stop_ids = [];
                let id = await db_route.countDocuments();
                for (let j = 0; j < trips[code].stops.length; j++) {
                    stop_ids.push(ac_stops[trips[code].stops[j]]);
                }
                let new_route = new db_route({'code': route_code, 'line_id': ac_lines[name], 'stop_ids': stop_ids,
                'point_indexes': [], 'stop_indexes': [], 'id': id});
                ac_indexes.push(await new_route.save());
                routes_to_route.push(ac_indexes[ac_indexes.length - 1]);
                ac_objects[route_code] = {'line_id': ac_lines[name],
                    'stop_ids': stop_ids, 'id': ac_indexes[ac_indexes.length - 1]};
            } else {
                let diff = false;
                let stop_ids = [];
                let id = await db_route.countDocuments();
                for (let j = 0; j < ac_objects[route_code].stop_ids.length; j++) {
                    diff = !ac_objects[route_code].stop_ids[j].equals(ac_stops[trips[code].stops[j]]);
                    stop_ids.push(ac_stops[trips[code].stops[j]]);
                }
                if (!ac_objects[route_code].line_id.equals(ac_lines[name]) || diff) {
                    let new_route = new db_route({'code': route_code, 'line_id': ac_lines[name], 'stop_ids': stop_ids,
                        'point_indexes': [], 'stop_indexes': [], 'id': id});
                    ac_indexes.push(await new_route.save());
                    ac_objects[route_code] = {'line_id': ac_lines[name],
                        'stop_ids': stop_ids, 'id': ac_indexes[ac_indexes.length - 1]};
                    routes_to_route.push(ac_indexes[ac_indexes.length - 1]);
                } else {
                    if (ac_indexes.indexOf(ac_objects[route_code].id) === -1) {
                        ac_indexes.push(ac_objects[route_code].id);
                    }
                }
            }
        } else if (type === 3) {
            if (line_len < 8) {
                continue;
            }

            name = input[i][0];
            code = input[i][2];
            service_id = parseInt(input[i][1]);

            let trip_code = trips[code].dep_time + '/' + name + '/' + trips[code].stops.toString();
            let route_id = ac_routes[name + '/' + trips[code].stops.toString()];

            if (route_id === undefined) {
                continue;
            }

            if (ac_objects[trip_code] === undefined) {
                let id = await db_trip.countDocuments();
                let new_trip = new db_trip({'code': trip_code, 'dep_time': trips[code].dep_time,
                    'route_id': route_id, 'id': id});
                ac_indexes.push(await new_trip.save());
            } else {
                if (!ac_objects[trip_code].route_id.equals(route_id)) {
                    let id = await db_trip.countDocuments();
                    let new_trip = new db_trip({'code': trip_code, 'dep_time': trips[code].dep_time,
                        'route_id': route_id, 'id': id});
                    ac_indexes.push(await new_trip.save());
                } else {
                    ac_indexes.push(ac_objects[trip_code].id);
                }
            }

            if (services.indexOf(service_id) !== -1) {
                let new_rec = new db_api({'api_code': api[code], 'trip_id': ac_indexes[ac_indexes.length - 1]});
                await new_rec.save();
                stats.trips_to_process += 1;
            }
        }
    }

    let new_ac_indexes;
    switch (type) {
        case 0:
            await db_ac_stops.deleteMany({});
            new_ac_indexes = new db_ac_stops({'stops': ac_indexes});
            await new_ac_indexes.save();
            stats.stops = ac_indexes.length;
            break;
        case 1:
            await db_ac_lines.deleteMany({});
            new_ac_indexes = new db_ac_lines({'lines': ac_indexes});
            await new_ac_indexes.save();
            stats.lines = ac_indexes.length;
            break;
        case 2:
            await db_ac_routes.deleteMany({});
            new_ac_indexes = new db_ac_routes({'routes': ac_indexes});
            await new_ac_indexes.save();
            stats.routes = ac_indexes.length;
            break;
        case 3:
            await db_ac_trips.deleteMany({});
            new_ac_indexes = new db_ac_trips({'trips': ac_indexes});
            await new_ac_indexes.save();
            stats.trips = ac_indexes.length;
            break;
        default: break;
    }
}

// Funkcia zodpovedná za aktualizáciu dát o services v DB
async function preprocess_services_file(file, exceptions) {
    let input = file.data.toString().split('\n');
    let exception_input = exceptions.data.toString().split('\n');
    input.shift();
    exception_input.shift();

    let date_val = new Date();
    date_val.setHours(0, 0, 0, 0);

    let date_intern = date_val.getFullYear().toString() +
        ((date_val.getMonth() + 1) < 10 ? '0' + (date_val.getMonth() + 1).toString() : (date_val.getMonth() + 1).toString()) +
        (date_val.getDate() < 10 ? '0' + date_val.getDate().toString() : date_val.getDate().toString());

    for (let i = 0; i < input.length; i++) {
        // Parsovanie parametrov z .txt súboru
        input[i] = input[i].replace(/"/g, '').split(',');
        let line_len = input[i].length;

        if (line_len < 10) {
            continue;
        }

        let service_id = parseInt(input[i][0]);
        let start = input[i][8];
        let end = input[i][9];
        let day = date_val.getDay();
        if(day === 0) {
            day = 7;
        }

        // V ktoré dni v týždni je service vykonávaná
        if (start <= date_intern && date_intern <= end) {
            if (input[i][day] === '1') {
                services.push(service_id);
            }
        }
    }

    for (let i = 0; i < exception_input.length; i++) {
        // Parsovanie parametrov z .txt súboru
        exception_input[i] = exception_input[i].replace(/"/g, '').split(',');
        let line_len = exception_input[i].length;

        if (line_len < 3) {
            continue;
        }

        let service_id = parseInt(exception_input[i][0]);

        if (exception_input[i][1] === date_intern) {
            // 2 - Výnimka, odober service pre tento deň, spoj nepôjde
            if (parseInt(exception_input[i][2]) === 2) {
                if (services.indexOf(service_id) !== -1) {
                    services.splice(services.indexOf(service_id), 1);
                }
                // 1 - Výnimka, pridaj service pre tento deň, spoj pôjde
            } else if (parseInt(exception_input[i][2]) === 1) {
                services.push(service_id);
            }
        }
    }
}

// Funkcia pre predprípravu kódov zastávok na jednotlivých tripoch
function preprocess_trips(file) {
    let input = file.data.toString().split('\n');
    input.shift();

    // Prejdeme celý súbor a pre každý index tripu vytvoríme pole kódov zastávok, cez ktoré trip prechádza
    for (let i = 0; i < input.length; i++) {
        input[i] = input[i].replace(/"/g, '').split(',');
        let line_len = input[i].length;

        if (line_len < 7 || input[i][0] === undefined) {
            continue;
        }

        if (trips[input[i][0]] === undefined) {
            trips[input[i][0]] = {'stops': [], 'dep_time': ""};
        }

        if (trips[input[i][0]].dep_time === "") {
            trips[input[i][0]].dep_time = input[i][2];
        }

        // Ako dočasný priestor pre uloženie používame globálnu premennú
        trips[input[i][0]].stops.push(input[i][3]);
    }
}

function preprocess_apis(file) {
    let input = file.data.toString().split('\n');

    for (let i = 0; i < input.length; i++) {
        input[i] = input[i].replace(/"/g, '').split(' ');
        let line_len = input[i].length;

        if (line_len < 6 || input[i][0] === undefined) {
            continue;
        }

        let code = parseInt(input[i][5]);
        api[code] = parseInt(input[i][3].split('/')[1]);
    }
}

// Funkcia riadiaca routing
async function apply_routing() {
    let ac_records, ac_stops = {}, ac_lines = {}, rail_hubs, road_hubs, ac_routes = {};

    if (routes_to_route.length === 0) {
        utils.write_to_log('Routing is not necessary, all routes are up to date', 'gtfs');
        return 0;
    }

    ac_records = await db_route.find({
        '_id': { $in: routes_to_route}
    }, 'line_id stop_ids stop_indexes point_indexes');
    for (let i = 0; i < ac_records.length; i++) {
        ac_routes[ac_records[i]._id] = {'line_id': ac_records[i].line_id, 'stop_ids': ac_records[i].stop_ids,
            'stop_indexes': ac_records[i].stop_indexes, 'point_indexes': ac_records[i].point_indexes};
    }

    ac_records = await db_ac_stops.find();
    if (ac_records[0] !== undefined) {
        ac_records = await db_stop.find({
            '_id': { $in: ac_records[0].stops}
        }, 'coords');
        for (let i = 0; i < ac_records.length; i++) {
            ac_stops[ac_records[i]._id] = ac_records[i].coords;
        }
    }

    ac_records = await db_ac_lines.find();
    if (ac_records[0] !== undefined) {
        ac_records = await db_line.find({
            '_id': { $in: ac_records[0].lines}
        }, 'type line_id');
        for (let i = 0; i < ac_records.length; i++) {
            ac_lines[ac_records[i]._id] = {'type': ac_records[i].type, 'name': ac_records[i].line_id};
        }
    }

    // Routing trás električiek a vlakov
    utils.write_to_log('Routing new trams and trains routes', 'gtfs')
    utils.write_to_log('This may take some time, please wait', 'gtfs')

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

    let codes = Object.keys(ac_routes);
    let promises = [];
    let show_progress = utils.progress_log('Trams & trains routes', codes.length);
    show_progress.start();

    // Prechádzame aktuálne trasy a hľadáme tie, ktoré budú potrebovať routing
    for (let i = 0; i < codes.length; i++) {
        if (ac_lines[ac_routes[codes[i]].line_id].type === 0 || ac_lines[ac_routes[codes[i]].line_id].type === 2) {
            let stops = [];
            for(let j = 0; j < ac_routes[codes[i]].stop_ids.length; j++) {
                stops.push(ac_stops[ac_routes[codes[i]].stop_ids[j]]);
            }
            promises.push(find(stops, rail_hubs, codes[i], ac_lines[ac_routes[codes[i]].line_id], show_progress, i));
        }
    }

    await Promise.all(promises);
    show_progress.finish();
    utils.write_to_log('Routing new trams and trains routes has finished', 'gtfs');

    // Routing trás autobusov a trolejbusov
    utils.write_to_log('Routing new buses and trolleybuses routes', 'gtfs');
    utils.write_to_log('This may take some time, please wait', 'gtfs');

    show_progress = utils.progress_log('Buses & trolleybuses routes', codes.length);
    show_progress.start();
    promises = [];

    // Prechádzame aktuálne trasy a hľadáme tie, ktoré budú potrebovať routing trasy
    for (let i = 0; i < codes.length; i++) {
        if (ac_lines[ac_routes[codes[i]].line_id].type === 3 || ac_lines[ac_routes[codes[i]].line_id].type === 800) {
            let stops = [];
            for(let j = 0; j < ac_routes[codes[i]].stop_ids.length; j++) {
                stops.push(ac_stops[ac_routes[codes[i]].stop_ids[j]]);
            }
            promises.push(find(stops, road_hubs, codes[i], ac_lines[ac_routes[codes[i]].line_id], show_progress, i));
        }
    }

    await Promise.all(promises);
    show_progress.finish();
    utils.write_to_log('Routing new buses and trolleybuses routes has finished', 'gtfs');
}

// Promise funkcia pre routing
function find(stops, hubs, route_id, route, prog, val) {
    return new Promise(function(resolve, reject) {
        // Routing pre elektičky
        if (route.type === 0) {
            routing.find_route(stops, hubs,'tram', false).
            then((result) => {
                save(route_id, result.point_indexes, result.stop_indexes, prog, val).then(() => resolve());
            });
        // Routing pre vlaky
        } else if (route.type === 2) {
            // Špeciálny prípad pre vlaky, ktoré v stanici vykonávajú úvrať
            let can_return = ['L146D99', 'L144D99', 'L135D99', 'L126D99'];
            if (can_return.indexOf(route.name) !== -1) {
                routing.find_route(stops, hubs, 'rail', true).
                then((result) => {
                    save(route_id, result.point_indexes, result.stop_indexes, prog, val).then(() => resolve());
                });
            } else {
                routing.find_route(stops, hubs, 'rail', false).
                then((result) => {
                    save(route_id, result.point_indexes, result.stop_indexes, prog, val).then(() => resolve());
                });
            }
        // Routing pre autobusy a trolejbusy
        } else {
            routing.find_route(stops, hubs, 'road', false).
            then((result) => {
                save(route_id, result.point_indexes, result.stop_indexes, prog, val).then(() => resolve());
            });
        }
    });
}

// Ukladanie vyroutovaných trás do DB
async function save(route_id, point_indexes, stop_indexes, prog, val) {
    await db_route.findByIdAndUpdate(route_id, {'$set': {'point_indexes': point_indexes, 'stop_indexes': stop_indexes}});
    prog.actualise(val);
}

module.exports = {actualise_GTFS_data};