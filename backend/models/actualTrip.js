/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre aktuálne verzie spojov
const actualTripSchema = new mongoose.Schema({
    trips: [{
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Trip'
    }]
})

module.exports = mongoose.model('actualTrip', actualTripSchema);