/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');

// DB model pre zastávku
const stopSchema = new mongoose.Schema({
    // Kód zastávky, napríklad U15775Z2
    stop_id: {
        required: true,
        type: String
    },
    // Verejný názov zastávky, napríklad Skácelova
    name: {
        required: true,
        type: String
    },
    // Geografické súradnice zastávky
    coords: {
        required: true,
        type: [Number]
    }
})

module.exports = mongoose.model('Stop', stopSchema);