/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre spoje, ktoré majú byť spracované v určitý deň
const apiSchema = new mongoose.Schema({
    // Interný kód spoja podľa KORDISu
    api_code: {
        required: true,
        type: Number
    },
    // Kód trasy, ktorú spoj vykonáva podľa GTFS
    trip_id: {
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Trip'
    }
})

module.exports = mongoose.model('Api', apiSchema)