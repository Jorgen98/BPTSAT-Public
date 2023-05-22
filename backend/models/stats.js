/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');

// DB model pre štatistiky
const statsSchema = new mongoose.Schema({
    // Aktuálny počet zastávok
    stops: {
        required: true,
        type: Number
    },
    // Aktuálny počet liniek
    lines: {
        required: true,
        type: Number
    },
    // Aktuálny počet trás
    routes: {
        required: true,
        type: Number
    },
    // Aktuálny počet spojov
    trips: {
        required: true,
        type: Number
    },
    // Aktuálny počet spojov, ktoré by mali byť spracované
    trips_to_process: {
        required: true,
        type: Number
    },
    // Počet spojov získaných zo zdrojovej DB
    downloaded_trips: {
        required: true,
        type: Number
    },
    // Počet uložených spojov
    processed_trips: {
        required: true,
        type: Number
    },
    // Časová značka, pre ktorý deň sú dáta platné
    valid: {
        required: true,
        type: Number
    }
})

module.exports = mongoose.model('DBStats', statsSchema)