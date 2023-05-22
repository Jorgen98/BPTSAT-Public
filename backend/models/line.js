/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');

// DB model pre linky
const lineSchema = new mongoose.Schema({
    // Kód linky vo formáte napríklad L1D99
    line_id: {
        required: true,
        type: String
    },
    // Označenie pre verejnosť, napríklad N99
    name: {
        required: true,
        type: String
    },
    // Druh dopravy
    // 0 - električka, 2 - vlak, 800 - trolejbus, 3 - autobus
    type: {
        required: true,
        type: Number
    },
    // Farba trasy podľa GTFS
    color: {
        required: true,
        type: String
    }
})

module.exports = mongoose.model('Line', lineSchema)