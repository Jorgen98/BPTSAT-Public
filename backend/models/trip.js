/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre jednotlivé spoje
const tripSchema = new mongoose.Schema({
    // Unikátny kód spoja zložený z kódu linky, poradia zastávok a času odchodu
    code: {
        required: true,
        type: String
    },
    // Čas odchodu spoja z počiatočnej zastávky
    dep_time: {
        required: true,
        type: String
    },
    // Kód trasy, ktorú spoj vykonáva
    route_id: {
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Route'
    },
    // Id pre identifikáciu pri API požiadavkách
    id: {
        required: true,
        type: Number
    }
})

module.exports = mongoose.model('Trip', tripSchema)