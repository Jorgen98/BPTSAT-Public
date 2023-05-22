/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */


/* Poznámky k fungovaniu custom routingu
 * Keďže je celá sieť tvorená bodmi, je dôležité povedať, že trasa je hľadaná tak, aby zastávky padli medzi dva uzly
 * tvoriace priamku. Tým pádom je nevyhnutné, aby zastávka a dané dva body tvorili trojuholník bez tupých uhlov
 * a zároveň aby oba body boli v rovnakom stupni vzdialenosti od danej zastávky. Na miestach, kde to je možné konštanty
 * používané nie sú, avšak ak už nejaká použitá je, jej hodnota zodpovedá najoptimálnejšiemu výsledku testovania.
 * Základnou myšlienkou celého routingu je, že skúša možnosti a snaží sa konvergovať k cieľu cez výpočet vzdialenosti
 * od tohto cieľa. Tým pádom, ak sa možnosti trasy vyvíjajú dobre, roting pokračuje. Naopak, ak sa skóre nezlepšuje,
 * routing skonči. Samotné skóre pre jednotlivé možnosti je založené na ich aktuálnej dĺžke a súčte uhlov, ktoré vznikajú
 * pri routovaní možnosti. Takto je zabezpečené to, aby ak je možnosť kratšia, ale obsahuje nadbytočné uhly, má horšie
 * skóre, ako možnosť porovnateľne dlhá ale bez nezmyselných chvostov.
 */

let hubs;

// Riadiaca funkcia
async function find_route(ac_route_stops, loaded_hubs, type, can_return = false) {
    hubs = loaded_hubs;

    // Inicializácia premenných
    // Maximálny počet iterácií, hľadania možností koncových uzlov
    let max_iter = 0;
    // Maximálny počet prerezávania možností
    let max_cuts = 5;
    // Možnosti, kam sa trasa vyvíja
    let possibilities = [];
    // Koncové uzly
    let finish_hubs = [];
    // Výsledky routingu
    let route_point_indexes = [];
    let stop_indexes = [];

    if (type === 'tram') {
        max_iter = 60;
    } else if (type === 'rail') {
        max_iter = 90;
    } else if (type === 'road') {
        max_iter = 15;
    } else {
        return -1;
    }

    stop_indexes.push(0);

    // Samotný routing
    // Vždy je hľadaná trasa medzi dvoma zastávkami, potom sú všetky úseky spojené do jednej trasy
    for (let i = 0; i < (ac_route_stops.length - 1); i++) {
        let start_stop = ac_route_stops[i];
        let finish_stop = ac_route_stops[i + 1];
        let best_possibility = 0;
        let best_score = Infinity;
        let stop_found = false;
        let distance = Infinity;
        let score = Infinity;

        // Nájdenie počiatočného uzla
        if (i === 0 || possibilities.length === 0 || finish_hubs.length === 0) {
            let first_hubs;
            if (type === 'tram') {
                first_hubs = find_stop_hubs(start_stop, 2, 22);
            } else if (type === 'rail') {
                first_hubs = find_stop_hubs(start_stop, 1, 120);
            } else {
                first_hubs = find_stop_hubs(start_stop, 2, 22);
            }

            // Definujeme si počiatočné možnosti, kde bude routing začínať
            for (let j = 0; j < first_hubs.length; j++) {
                let hub = hubs[first_hubs[j].hub];
                for (let k = 0; k < hub.n.length; k++) {
                    // Zastávka a dva počiatočné uzly musia tvoriť trojuholník s ostrými uhlami
                    if (triangulation(hub.n[k], first_hubs[j].hub, start_stop, true)){
                        possibilities.push({'hub': hub.n[k], 'score': first_hubs[j].score,
                            'visited': [first_hubs[j].hub], 'finish': false});
                        possibilities.push({'hub': first_hubs[j].hub, 'score': first_hubs[j].score,
                            'visited': [hub.n[k]], 'finish': false});
                    }
                }
            }
        }

        // Nájdeme koncové uzly
        finish_hubs = [];
        if (type === 'tram') {
            finish_hubs = find_stop_hubs(finish_stop, 1, 22);
        } else if (type === 'rail') {
            finish_hubs = find_stop_hubs(finish_stop, 1, 120);
        } else {
            finish_hubs = find_stop_hubs(finish_stop, 1, 22);
        }

        // Ak máme začiatok aj koniec úseku, skúsime nájsť spojenie
        if (finish_hubs.length > 0 && possibilities.length > 0) {
            for (let j = 0; j < max_iter; j++) {

                // Aktualizujeme možnosti, prehľadáme susedov súčasných uzlov
                possibilities = actualize_possibilities(possibilities);

                // Už sa nie je kam posunúť, trasu sme nenašli
                if (possibilities.length === 0) {
                    break;
                }

                // Overíme, či nejaká z možností nedospela do cieľa
                for (let k = 0; k < possibilities.length; k++) {
                    for (let l = 0; l < finish_hubs.length; l++) {
                        if (finish_hubs[l].hub === possibilities[k].hub &&
                            triangulation(possibilities[k].hub, possibilities[k].visited[possibilities[k].visited.length - 1], finish_stop, true)) {
                            possibilities[k].finish = true;
                        }

                        if (finish_hubs[l].hub === possibilities[k].visited[possibilities[k].visited.length - 1] &&
                            triangulation(possibilities[k].hub, possibilities[k].visited[possibilities[k].visited.length - 1], finish_stop, true)) {
                            possibilities[k].finish = true;
                        }
                    }
                }

                // Síce mohla nejaká možnosť dospieť do cieľa, ale nie sú ešte nejaké perspektívnejšie možnosti?
                best_score = Infinity;
                for (let k = 0; k < possibilities.length; k++) {
                    if (possibilities[k].score < best_score) {
                        best_possibility = k;
                        best_score = possibilities[k].score;
                    }
                }

                // Nie sú, máme trasu s najlepším výsledkom
                if (possibilities[best_possibility].score === best_score && possibilities[best_possibility].finish) {
                    stop_found = true;
                    break;
                }

                // V danom počte iterácií sme cieľ nedosiahli, má zmysel pokračovať?
                if (j === (max_iter - 1)) {
                    if (max_cuts > 0) {
                        j = 0;

                        let ac_distance = Infinity;
                        let ac_score = Infinity;

                        for (let k = 0; k < possibilities.length; k++) {
                            let acc_dist = dist_point_stop(possibilities[k].hub, finish_stop);
                            if (acc_dist < ac_distance) {
                                ac_distance = acc_dist;
                                ac_score = possibilities[k].score;
                            }
                        }

                        // Niečo sa od poslednej redukcie možností zlepšilo?
                        if (ac_distance < distance && ac_score !== score) {
                            // Áno, je to pozitívna zmena, treba pokračovať
                            distance = ac_distance;
                            score = ac_score;
                        } else {
                            // Nič sa nezlepšilo, zrejme sa točíme v kruhu, ale ešte tomu dáme šancu
                            max_cuts--;
                        }

                        // V prípade železnice a vysokého počtu možností je dobré to preriediť a počkať, či sa to zlepší
                        // alebo či nenájdeme cieľ
                        if (type === 'rail' || possibilities.length > 1000) {
                            possibilities = reduce_possibilities(possibilities, finish_stop, 10);
                        }
                    } else {
                        // Už to malo šancí dosť, routing neuspel, nemôžeme to skúšať do nekonečna
                        break;
                    }
                }
            }
        }
        max_cuts = 5;

        // Ak sme trasu našli, uložíme si ju
        if (stop_found) {
            let points = [...possibilities[best_possibility].visited];

            for (let j = 0; j < (points.length - 1); j++) {
                route_point_indexes.push(points[j]);
            }

            if (i === (ac_route_stops.length - 2)) {
                route_point_indexes.push(possibilities[best_possibility].hub);
            }

            stop_indexes.push(route_point_indexes.length);

            // Nájdenú trasu použijeme ako základ pre routovanie ďalšieho úseku
            possibilities = [{'hub': possibilities[best_possibility].hub,
                'score': dist_point_stop(possibilities[best_possibility].hub, finish_stop),
                'visited': [possibilities[best_possibility].visited[possibilities[best_possibility].visited.length - 1]], 'finish': false}];

            // V niektorých prípadoch na železnici dochádza k úvrati, teda že spoj sa vracia po časti trasy, po ktorej prišiel. Pre takéto prípady
            // je nevyhnutné, aby bol zmenený zoznam navštívených uzlov, aby sa trasovanie mohlo vydať aj tak, odkiaľ predtým prišlo.
            if (can_return) {
                possibilities[0].visited = [possibilities[0].hub];
            }
        } else {
            route_point_indexes.push(-1);
            possibilities = [];
        }
    }

    return {'point_indexes': route_point_indexes, 'stop_indexes': stop_indexes};
}

// Aktualizácia možností potenciálnej trasy
function actualize_possibilities(possibilities) {
    let new_possibilities = [];
    let avg_score = 0;

    // Aktualizovať budeme len spodnú polovicu možností zoradených podľa dĺžky
    // Je tak zaručené rovnomernejšie rozloženie
    for (let i = 0; i < possibilities.length; i++) {
        avg_score += possibilities[i].score
    }
    avg_score /= possibilities.length;

    for (let i = 0; i < possibilities.length; i++) {
        if (possibilities[i].finish || possibilities[i].score > avg_score) {
            new_possibilities.push(possibilities[i]);
        } else {
            let cur_hub = possibilities[i].hub;
            possibilities[i].visited.push(cur_hub);
            // Analyzujeme každého suseda súčasného uzla
            for (let j = 0; j < hubs[cur_hub].n.length; j++) {
                if (possibilities[i].visited.indexOf(hubs[cur_hub].n[j]) === -1) {
                    let point_a = hubs[possibilities[i].visited[possibilities[i].visited.length - 2]].p;
                    let point_b = hubs[cur_hub].p;
                    let point_c = hubs[hubs[cur_hub].n[j]].p;

                    let angle = get_angle(point_a, point_b, point_c);

                    if (isNaN(angle)) {
                        angle = 0.6;
                    }
                    // Ak je nasledujúci uzol v tupom uhle so súčasným, posunieme sa naň
                    // Takto vzniká aj štiepenie možnosti
                    if (angle > 0.5) {
                        let new_score = dist_point_point(cur_hub, hubs[cur_hub].n[j]) + (3.14 - angle);
                        new_possibilities.push({'hub': hubs[cur_hub].n[j], 'score': possibilities[i].score + new_score,
                            'visited': [...possibilities[i].visited], 'finish': false})
                    }
                }
            }
        }
    }

    return new_possibilities;
}

// Redukcia možností na základe ich vzdialenosti od cieľa
function reduce_possibilities(possibilities, next, num_of_pos = 5) {
    let new_possibilities = [];
    let scores = {};

    // Spočítame vzdialenosti
    for (let i = 0; i < possibilities.length; i++) {
        if (possibilities[i].finish) {
            new_possibilities.push(possibilities[i]);
        } else {
            let score = dist_point_stop(possibilities[i].hub, next) + possibilities[i].score;
            scores[score] = i;
        }
    }

    let best_options = Object.keys(scores).sort(sort_indexes);

    // Uložíme si iba num_of_pos možnosti s najkratšími vzdialenosťami
    for (let i = 0; i < num_of_pos && i < best_options.length; i++) {
        new_possibilities.push(possibilities[scores[best_options[i]]]);
    }

    return new_possibilities;
}

// Vráti num_of_points uzlov siete, ktorým daná zastávka patrí
function find_stop_hubs(from, num_of_points = 1,  distance = 10) {
    let scores = {};

    let max_iterations = 4;
    let coefficient = 1.75;

    let j = 0;

    // Iteratívne hľadáme uzly vzhľadom na vzdialenosť a polohu
    do {
        scores = {};
        for (let i = 0; i < hubs.length; i++) {
            let score = dist_point_stop(i, from);
            if (score < distance) {
                let hub = hubs[i];
                for (let k = 0; k < hub.n.length; k++) {
                    let in_score = dist_point_stop(hub.n[k], from);
                    // Vrátené su iba uzly, ktoré so zastávkou tvoria ostrouhlý trojuholník
                    if (in_score < distance && triangulation(i, hub.n[k], from, true)) {
                        scores[triangulation(i, hub.n[k], from)] = i;
                    }
                }
            }
        }
        j++;
        distance = distance * coefficient;
    } while (j < max_iterations && Object.keys(scores).length < 4);

    let best_options = Object.keys(scores).sort(sort_indexes);
    let result_hubs = [];

    // Vrátime možnosti a ich skóre
    for (let i = 0; i < num_of_points && i < best_options.length; i++) {
        if (parseFloat(best_options[i]) !== Infinity) {
            result_hubs.push({'hub': scores[best_options[i]], 'score': dist_point_stop(scores[best_options[i]], from) * parseFloat(best_options[i])});
        }
    }

    return result_hubs;
}

function dist_point_stop(index, stop) {
    return count_distance(hubs[index].p, stop);
}

function dist_point_point(index_a, index_b) {
    return count_distance(hubs[index_a].p, hubs[index_b].p);
}

// Výpočet vzdialenosti medzi dvoma bodmi
function count_distance(point_a, point_b) {
    // Výpočet vzdialenosti pomocou Haversine formuly
    // Prevzaté z https://www.movable-type.co.uk/scripts/latlong.html
    const R = 6371e3;
    let lat_1_rad = point_a[0] * Math.PI / 180;
    let lat_2_rad = point_b[0] * Math.PI / 180;
    let delta_1 = (point_b[0]- point_a[0]) * Math.PI / 180;
    let delta_2 = (point_b[1]-point_a[1]) * Math.PI / 180;

    let a = Math.sin(delta_1 / 2) * Math.sin(delta_1 / 2) + Math.cos(lat_1_rad) * Math.cos(lat_2_rad) *
        Math.sin(delta_2 / 2) * Math.sin(delta_2 / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return(R * c);
}

// Výpočet uhla medzi troma bodmi
function triangulation(hub_a, hub_b, point, is_triangle = false) {
    // Vrchol A
    let geo_hub_a = hubs[hub_a].p;
    // Vrchol B
    let geo_hub_b = hubs[hub_b].p;
    // Vrchol C
    let geo_point = point;

    let angle_CAB = get_angle(geo_point, geo_hub_a, geo_hub_b);
    let angle_CBA = get_angle(geo_point, geo_hub_b, geo_hub_a);

    // Ak sú oba uhly ostré, vrcholy tvoria ostrouhlý trojuholník
    if (is_triangle) {
        return angle_CAB < 1.61 && angle_CBA < 1.61;
    }

    if (angle_CAB > 1.61 && angle_CBA > 1.61) {
        return Infinity;
    } else if (angle_CAB > 1.61) {
        return Math.sin(angle_CBA) * count_distance(geo_point, geo_hub_b);
    } else if (angle_CBA > 1.61) {
        return Math.sin(angle_CAB) * count_distance(geo_point, geo_hub_a);
    } else {
        return Math.min(Math.sin(angle_CAB) * count_distance(geo_point, geo_hub_a), Math.sin(angle_CBA) * count_distance(geo_point, geo_hub_b));
    }
}
// Výpočet uhla
function get_angle(x, y, z) {
    let x_y = Math.sqrt(Math.pow(y[0] - x[0], 2)+ Math.pow(y[1] - x[1], 2));
    let y_z = Math.sqrt(Math.pow(y[0] - z[0], 2)+ Math.pow(y[1] - z[1], 2));
    let x_z = Math.sqrt(Math.pow(z[0] - x[0], 2)+ Math.pow(z[1] - x[1], 2));

    return Math.acos((y_z * y_z + x_y * x_y - x_z * x_z) / (2 * y_z * x_y));
}

// Sorting
function sort_indexes(a, b) {
    if (parseFloat(a) > parseFloat(b)) {
        return 1;
    }
    if (parseFloat(a) < parseFloat(b)) {
        return -1;
    }
    return 0;
}

module.exports = { find_route };