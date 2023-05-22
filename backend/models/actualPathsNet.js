/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre aktuálne verzie path súborov
const actualPathSchema = new mongoose.Schema({
    rail: {
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'PathsNet'
    },
    rail_valid: {
        required: true,
        type: Number
    },
    road: {
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'PathsNet'
    },
    road_valid: {
        required: true,
        type: Number
    }
})

module.exports = mongoose.model('ActualPathsNet', actualPathSchema);