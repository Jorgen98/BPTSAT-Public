/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre aktuálne verzie trás
const actualRouteSchema = new mongoose.Schema({
    routes: [{
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Route'
    }]
})

module.exports = mongoose.model('actualRoute', actualRouteSchema);