/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const fs = require('fs');

const utils = require('./utils');
const db_net = require('../models/pathsNet');
const db_ac_nets = require('../models/actualPathsNet');

const nets_folder = './static_files/';

// Funkcia určená pre načítavanie path definitions súborov, ktoré sú základom pre routing
// Stačí do static_files vložiť nový súbor a spustiť
// Funkcia nahrá obsah do DB a tento sa použije pri routovaní
// Staršie verzie sú uchovávané pre vykresľovanie pri historických dátach
async function load_data_to_DB() {
    utils.write_to_log('Actualisation of path files has started', 'paths')
    utils.write_to_log('Looking for files in static_files directory', 'paths');
    let actual_road_net, actual_rail_net, actual_road_valid = 0, actual_rail_valid = 0, actual_records;

    try {
        actual_records = await db_ac_nets.find();
        if (actual_records[0] !== undefined) {
            actual_road_net = actual_records[0].road;
            actual_road_valid = actual_records[0].road_valid;
            actual_rail_net = actual_records[0].rail;
            actual_rail_valid = actual_records[0].rail_valid;
        }
    } catch (err) {
        utils.write_to_log(err.message, 'fail');
        return -1;
    }

    // Prejdeme súbory a ak nájdeme novú verziu, vložíme ju do DB
    for (const file of fs.readdirSync(nets_folder)) {
        let raw = fs.readFileSync(nets_folder + file);
        let input;
        try {
            input = JSON.parse(raw);
        } catch (err){
            continue;
        }

        if (input.type === 'road' && actual_road_valid < input.valid) {
            let new_net = new db_net({'type': input.type, 'hubs': input.hubs})
            actual_road_net = await new_net.save();
            actual_road_valid = input.valid;
        }

        if (input.type === 'rail' && actual_rail_valid < input.valid) {
            let new_net = new db_net({'type': input.type, 'hubs': input.hubs})
            actual_rail_net = await new_net.save();
            actual_rail_valid = input.valid;
        }
    }

    await db_ac_nets.deleteMany({});
    let new_ac_indexes = new db_ac_nets({'road': actual_road_net, 'rail': actual_rail_net,
    'road_valid': actual_road_valid, 'rail_valid': actual_rail_valid});
    await new_ac_indexes.save();
    utils.write_to_log('Actualisation of path files has finished', 'paths')
}

module.exports = {load_data_to_DB};
