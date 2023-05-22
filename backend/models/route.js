/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre jednotlivé trasy
const routeSchema = new mongoose.Schema({
    // Unikátny kód trasy zložený z kódu linky a poradia zastávok
    code: {
        required: true,
        type: String
    },
    // Kód linky, pod ktorú trasa patrí, zodpovedá line.line_id
    line_id: {
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Line'
    },
    // Zoznam kódov zastávok na trase
    stop_ids: {
        required: true,
        type: [Schema.Types.ObjectId],
        ref: 'Stop'
    },
    // Zoznam uzlov na trase
    // V prípade -1 trasu nebolo možné vypočítať
    point_indexes: {
        required: true,
        type: [Number]
    },
    // Indexy zastávok vzhľadom na point_indexes, určujú, medzi ktoré uzly zastávka na trase patrí
    stop_indexes: {
        required: true,
        type: [Number]
    },
    // Id pre identifikáciu pri API požiadavkách
    id: {
        required: true,
        type: Number
    }
})

module.exports = mongoose.model('Route', routeSchema)