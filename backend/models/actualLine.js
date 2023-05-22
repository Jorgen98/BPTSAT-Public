/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre aktuálne verzie liniek
const actualLineSchema = new mongoose.Schema({
    lines: [{
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Line'
    }]
})

module.exports = mongoose.model('actualLine', actualLineSchema);