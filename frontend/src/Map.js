/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

import React, {Component} from "react";
import L from "leaflet";
import Categories from "./DelayCategories";
import * as ReactDOM from 'react-dom/client';
import Stats from "./Stats";
import {Selectors} from "./Selectors";
import { Message } from 'primereact/message';
import logoFIT from './icons/FIT.png';
import logoBrno from './icons/brno.png';

// Hlavná trieda celého frontendu

let who_to_ask;
if (process.env.MODE === 'docker') {
    who_to_ask = 'https://' + window.location.host + '/brno-PTSAT-be/';
} else {
    who_to_ask = 'http://localhost:3030/brno-PTSAT-be/';
}

class ReactMap extends Component {

    inner_elems = {
        control: null
    }

    inner_data = {
        lines: [],
        routes: {},
        trips: {}
    };

    ac_selected = {
        line: null,
        route: null,
        trip: null
    };

    ac_trip = {
        points: null,
        stops: null,
        delays: null,
        stop_indexes: null,
        av_delays: null,
        sum_of_delays: null,
        stop_stats: null
    };

    inner_props = {
        path_layer: null,
        details_layer: null,
        categories: null,
        stats_div: null,
        use_fill: true,
        use_toolTip: false
    };

    dates = {
        available: [],
        selected: [],
        ac_selected: []
    };

    status = {
        downloading_routes: false,
        downloading_trip: false
    }

    constructor(props) {
        super(props);

        this.state = {
            id: 'map',
            class: 'Map'
        };
    }

    getCategories = (data) => {
        this.inner_props.categories = data;
    }

    // Spracovanie dát získaných z BE
    async getData(link, mode) {
        return await fetch(link)
            .then(response => response.json())
            .then(data => {
                if (mode === 'dates') {
                    this.dates.available = [];
                    this.dates.selected = [];
                    for (let i = 0; i < data.length; i++) {
                        if (data[i].split('-').length === 2) {
                            for (let j = parseInt(data[i].split('-')[0]); j <= parseInt(data[i].split('-')[1]); j+=24*60*60*1000){
                                this.dates.available.push(new Date(j));
                            }
                        } else {
                            this.dates.available.push(new Date(parseInt(data[i])));
                        }
                    }
                    if (this.dates.available.length > 0) {
                        this.dates.selected = [this.dates.available[this.dates.available.length - 1]];
                    }
                } else if (mode === 'gtfs_data') {
                    let keys = Object.keys(data);
                    this.inner_data.lines = [];
                    this.inner_data.routes = {};
                    this.inner_data.trips = {};

                    for (let i = 0; i < keys.length; i++) {
                        this.inner_data.lines.push({'code': keys[i], 'name': data[keys[i]].name, 'type': data[keys[i]].type})
                        let data_trips = data[keys[i]].trips;
                        let trip_keys = [];
                        this.inner_data.routes[keys[i]] = [];
                        for (let j = 0; j < data_trips.length; j++) {
                            let id = keys[i] + '_' + data_trips[j].from + '_' + data_trips[j].to;
                            if (trip_keys.indexOf(id) === -1) {
                                this.inner_data.routes[keys[i]].push({'code': id,
                                    'name': data_trips[j].from + ' -> ' + data_trips[j].to});
                                trip_keys.push(id);
                            }
                            if (this.inner_data.trips[id] === undefined) {
                                this.inner_data.trips[id] = [];
                            }
                            let dep_hour = parseInt(data_trips[j].dep_time.split(':')[0]) < 10 ?
                                '0' + data_trips[j].dep_time.split(':')[0] : data_trips[j].dep_time.split(':')[0];
                            let dep_min = data_trips[j].dep_time.split(':')[1];
                            this.inner_data.trips[id].push({'route_id': data_trips[j].route_id,
                                'trip_id': data_trips[j].trip_id, 'dep_time': dep_hour + ':' + dep_min});
                        }
                        this.inner_data.routes[keys[i]].sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
                    }

                    keys = Object.keys(this.inner_data.trips);
                    for (let i = 0; i < keys.length; i++) {
                        this.inner_data.trips[keys[i]].sort((a,b) => (a.dep_time > b.dep_time) ? 1 : ((b.dep_time > a.dep_time) ? -1 : 0));
                    }
                    this.inner_data.lines.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));

                    this.ac_selected.line = 0;
                    this.ac_selected.route = 0;
                    this.ac_selected.trip = 0;
                } else if (mode === 'delay_data') {
                    this.ac_trip.delays = data.delays;
                    this.ac_trip.points = data.points;
                    this.ac_trip.stop_indexes = data.stop_indexes;
                    this.ac_trip.stops = data.stops;
                }
                return 0;
            })
            .catch((error) => {
                console.error(error);
                return -1;
            })
    }

    contextMenuIndex = -1;

    // Rendrovanie ovládacích prvkov
    rightContextMenu(enabled) {
        let render_buttons = [];
        let context;

        if (this.contextMenuIndex !== 1) {
            this.dates.ac_selected = this.dates.selected;
        }

        let buttons = [
            {'icon': <i className="pi pi-filter-fill"/>,
                'context': <Stats fillState={this.inner_props.use_fill} fillChange={this.setFillOption}
                                  tipState={this.inner_props.use_toolTip} tipChange={this.setTipOption} enabled={enabled} type='0'/>},
            {'icon': <i className="pi pi-calendar-times"/>,
                'context': <Stats dates={this.dates.ac_selected} available={this.dates.available}
                                  onDatesChange={this.onDateChange} onDatesSet={this.onDateSet} enabled={enabled} type='1'/>},
            {'icon': <i className="pi pi-chart-bar"/>,
                'context': <Stats data={this.ac_trip.stop_stats} colors={this.inner_props.categories} enabled={enabled} type='2'/>},
            {'icon': <i className="pi pi-chart-line"/>,
                'context': <Stats data={this.ac_trip.sum_of_delays} enabled={enabled} type='3'/>}
        ]

        let class_name;
        for (let i = 0; i < buttons.length; i++) {
            let index;
            if (i === this.contextMenuIndex) {
                class_name = 'c_subcontrol_selected';
                index = -1;
            } else {
                class_name = 'c_unselected';
                index = i;
            }
            render_buttons.push(<button onClick={() => {this.contextMenuIndex = index; this.updateControl()}}
                className={class_name}>{buttons[i].icon}</button>)
        }

        let context_class_name;
        if (this.contextMenuIndex === -1) {
            context = null;
            context_class_name = 'c_subcontrol_body';
        } else {
            context = buttons[this.contextMenuIndex].context;
            context_class_name = 'c_subcontrol_body_content';
        }

        return ([<div className="c_subcontrol_menu" key='subcontrol_menu' onClick={event => event.stopPropagation()}
                      onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
                      onScroll={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
        >{render_buttons}</div>,
            <div className={context_class_name} key='subcontrol_body' onClick={event => event.stopPropagation()}
                 onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
                 onScroll={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
            >{context}</div>])
    }

    updateControl() {
        const t = this;
        let enabled = false;
        let message = null;
        if (this.status.downloading_routes || this.status.downloading_trip) {
            enabled = true;
            message = <Message severity="info" text="Načítání dat"/>;
        }

        const body = ([
            <div className="c_control_info" onClick={event => event.stopPropagation()}
                 onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
                 onScroll={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
                <div className="c_control_info_in_l">Analytický nástroj pro systém veřejné dopravy města Brna</div>
                <div className="c_control_info_in_r">
                    <a href="https://www.fit.vut.cz/.cs" target="_blank" rel="noopener noreferrer">
                        <img src={logoFIT} alt="FIT VUT" className="c_control_info_img" />
                    </a>
                    <a href="https://data.brno.cz/" target="_blank" rel="noopener noreferrer">
                        <img src={logoBrno} alt="data Brno" className="c_control_info_img" />
                    </a>
                </div>
            </div>,
            <div className="c_control_main">
                <div className="c_control_left">
                    <div className="c_control_zoom" onClick={event => event.stopPropagation()}
                         onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
                         onScroll={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
                        <button onClick={() => t.map.zoomIn()}>+</button>
                        <button onClick={() => t.map.zoomOut()}>-</button>
                    </div>
                    <Categories getCategories={this.getCategories} categories={this.inner_props.categories}/>
                </div>
                <div className="c_control_center">
                    <Selectors data={this.inner_data}
                               selected={this.ac_selected}
                               selectLine={this.selectLine}
                               selectRoute={this.selectRoute}
                               selectTrip={this.selectTrip}
                               enabled={enabled}/>
                    {message}
                </div>
                <div className="c_control_right">
                    <div className="c_subcontrol_div">
                        {this.rightContextMenu(enabled)}
                    </div>
                    <div className="c_control_contributors">
                        <a href="https://leafletjs.com" title="A JavaScript library for interactive maps">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8"
                             viewBox="0 0 12 8" className="leaflet-attribution-flag">
                            <path fill="#4C7BE1" d="M0 0h12v4H0z"></path>
                            <path fill="#FFD500" d="M0 4h12v3H0z"></path>
                            <path fill="#E0BC00" d="M0 7h12v1H0z"></path>
                        </svg>
                        Leaflet</a> <span aria-hidden="true">|</span> © <a
                        href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
                    </div>
                </div>
            </div>
        ])
        this.inner_elems.control.render(body);
    }

    setDefaults() {
        this.getData(who_to_ask + 'getData/get_dates', 'dates').then(() => {
            this.updateControl();
            this.getAvailableData();
            this.updateControl();
        });
    }

    selectLine = (line) => {
        for (let i = 0; i < this.inner_data.lines.length; i++) {
            if (this.inner_data.lines[i].code === line) {
                this.ac_selected.line = i;
            }
        }
        this.ac_selected.route = 0;
        this.updateControl();
        let trip = this.inner_data.trips[this.inner_data.routes[this.inner_data.lines[this.ac_selected.line].code][0].code][0];
        this.getDelayData(trip.route_id, trip.trip_id);
    }

    selectRoute = (route) => {
        let routes = this.inner_data.routes[this.inner_data.lines[this.ac_selected.line].code];
        for (let i = 0; i < routes.length; i++) {
            if (routes[i].code === route) {
                this.ac_selected.route = i;
            }
        }
        this.ac_selected.trip = 0;
        this.updateControl();
        let trip = this.inner_data.trips[this.inner_data.routes[this.inner_data.lines[this.ac_selected.line].code][this.ac_selected.route].code][0];
        this.getDelayData(trip.route_id, trip.trip_id);
    }

    selectTrip = (trip) => {
        let trips = this.inner_data.trips[this.inner_data.routes[this.inner_data.lines[this.ac_selected.line].code][this.ac_selected.route].code];
        for (let i = 0; i < trips.length; i++) {
            if (trips[i].route_id === trip.route_id && trips[i].trip_id === trip.trip_id) {
                this.ac_selected.trip = i;
                this.getDelayData(trips[i].route_id, trips[i].trip_id);
            }
        }
        this.updateControl();
    }

    getAvailableData() {
        if (this.dates.selected.length === 0) {
            this.inner_data.lines = [];
            this.inner_data.routes = {};
            this.inner_data.trips = {};
            this.updateControl();
        } else {
            if (!this.status.downloading_routes) {
                this.status.downloading_routes = true;
                this.updateControl();
                this.getData(who_to_ask + 'getData/get_available_routes?valid=' + this.zipDates(), 'gtfs_data').then((code) => {
                    if (code !== -1) {
                        if (this.inner_data.lines.length > 0) {
                            let trip = this.inner_data.trips[this.inner_data.routes[this.inner_data.lines[0].code][0].code][0];
                            this.getDelayData(trip.route_id, trip.trip_id);
                        }
                    }
                    this.status.downloading_routes = false;
                    this.updateControl();
                });
            }
        }
    }

    getDelayData(route_id, trip_id) {
        if (!this.status.downloading_trip) {
            this.status.downloading_trip = true;
            this.updateControl();
            this.getData(who_to_ask + 'getData/get_route?valid=' + this.zipDates() + '&route_id=' + route_id +
                '&trip_id=' + trip_id, 'delay_data').then(() => {
                this.updateDataOnMap();
                this.status.downloading_trip = false;
                this.updateControl();
            });
        }
    }

    zipDates() {
        let result = [], days = [];
        for (let i = 0; i < this.dates.selected.length; i++) {
            days.push(this.dates.selected[i].valueOf());
        }
        days.sort();
        let actual = days[0];
        for (let i = 1; i < days.length; i++) {
            if (Math.abs(days[i - 1] - days[i]) !== 24*60*60*1000) {
                if (actual !== days[i - 1]) {
                    result.push(actual + '-' + days[i - 1])
                } else {
                    result.push(actual.toString());
                }
                actual = days[i];
            }
        }
        if (actual !== days[days.length - 1]) {
            result.push(actual + '-' + days[days.length - 1])
        } else {
            result.push(actual.toString());
        }
        let result_string = '';

        for (let i = 0; i < (result.length - 1); i++) {
            result_string += result[i] + ',';
        }
        result_string += result[result.length - 1];
        return result_string;
    }

    setFillOption = () => {
        this.inner_props.use_fill = !this.inner_props.use_fill;
        this.updateDataOnMap();
        this.updateControl();
    }

    setTipOption = () => {
        this.inner_props.use_toolTip = !this.inner_props.use_toolTip;
        this.updateDataOnMap();
        this.updateControl();
    }

    onDateChange = (dates) => {
        this.dates.ac_selected = dates;
        this.updateControl();
    }

    onDateSet = () => {
        this.dates.selected = this.dates.ac_selected;
        this.updateControl();
        this.getAvailableData();
    }

    showPathDetails(index) {
        let details_layer = this.inner_props.details_layer;
        details_layer.eachLayer(function (layer) {
            details_layer.removeLayer(layer);
        });

        if (this.status.downloading_trip || this.status.downloading_routes) {
            return;
        }

        let min = this.ac_trip.stop_indexes[index - 1];
        if (min === undefined) {
            min = 0;
        } else {
            min += 1;
        }
        let max = this.ac_trip.stop_indexes[index];
        if (index === (this.ac_trip.stop_indexes.length - 1)) {
            max = this.ac_trip.points.length - 1;
        } else {
            max += 1;
        }

        let polyline;

        for (let i = min; i < max; i++) {
            let pointList = [this.ac_trip.points[i], this.ac_trip.points[i + 1]];
            polyline = L.polyline(pointList, {color: "black", weight: 12});

            polyline.addTo(details_layer);
        }

        for (let i = min; i < max; i++) {
            let pointList = [this.ac_trip.points[i], this.ac_trip.points[i + 1]];
            let count = 0, delay = 0;
            for (let j = 0; j < this.ac_trip.delays.length; j++) {
                if (this.ac_trip.delays[j][i] !== null) {
                    delay += this.ac_trip.delays[j][i];
                    count++;
                }
            }
            if (count === 0) {
                this.putPathOnMap(pointList, null, null, null, details_layer);
            } else {
                this.putPathOnMap(pointList, Math.round(delay / count * 100) / 100, null,
                    Math.round(delay / count * 100) / 100,
                    details_layer);
            }
        }
    }

    putPathOnMap(point_list, delay, click_index = null, popup_info = null, layer = this.inner_props.path_layer){
        let polyline;
        let t = this;

        if (delay === null) {
            polyline = L.polyline(point_list, {color: "LightGrey", weight: 4});
        } else {
            for (let j = 0; j < this.inner_props.categories.length; j++) {
                if (this.inner_props.categories[j].val >= delay) {
                    polyline = L.polyline(point_list, {color: this.inner_props.categories[j].col, weight: 4});
                    break;
                }
            }

            if (polyline === undefined) {
                polyline = L.polyline(point_list,
                    {color: this.inner_props.categories[this.inner_props.categories.length - 1].col, weight: 4});
            }
        }

        if (click_index !== null) {
            polyline.on("click", function (event) {
                t.showPathDetails(click_index);
                L.DomEvent.stop(event)})
        }

        if (popup_info !== null) {
            if (this.inner_props.use_toolTip) {
                polyline.bindTooltip(popup_info.toString()).openTooltip();
            }
            polyline.addTo(layer);
        } else {
            polyline.addTo(layer);
        }
    }

    updateDataOnMap() {
        let path_layer = this.inner_props.path_layer;
        let details_layer = this.inner_props.details_layer;
        path_layer.eachLayer(function (layer) {
            path_layer.removeLayer(layer);
        });
        details_layer.eachLayer(function (layer) {
            details_layer.removeLayer(layer);
        });

        let trip_points = this.ac_trip.points;
        let trip_stops = this.ac_trip.stops;
        let stop_indexes = this.ac_trip.stop_indexes;
        let delays = this.ac_trip.delays;
        stop_indexes.shift();

        let av_delays = [];
        let index = 0, delay = 0, count = 0;
        let stats_data = [], summed_data = [];

        for (let i = 0; i < (trip_points.length - 1); i++) {
            for (let j = 0; j < delays.length; j++) {
                if (delays[j][i] !== null) {
                    delay += delays[j][i];
                    count++;
                }
            }
            if (stop_indexes[index] === i || i === (trip_points.length - 2)) {
                let stats = [], stats_count = 0;
                for (let j = 0; j < this.inner_props.categories.length; j++) {
                    stats.push(0);
                }

                for (let j = 0; j < delays.length; j++) {
                    if (delays[j][i] !== null) {
                        for (let k = 0; k < this.inner_props.categories.length; k++) {
                            if (delays[j][i] <= this.inner_props.categories[k].val) {
                                stats[k]++;
                                stats_count++;
                                break;
                            }
                        }
                    }
                }

                for (let j = 0; j < this.inner_props.categories.length; j++) {
                    if (stats_count === 0) {
                        stats[j] = 0;
                    } else {
                        stats[j] = stats[j] / stats_count * 100;
                    }
                }
                stats_data.push({'name': trip_stops[index + 1].name, 'data': stats});

                if (count === 0) {
                    av_delays.push(null);
                    summed_data.push({'name': trip_stops[index + 1].name, 'data': 0});
                } else {
                    av_delays.push(Math.round(delay / count * 100) / 100);
                    summed_data.push({'name': trip_stops[index + 1].name, 'data': delay});
                }
                delay = 0;
                count = 0;
                index++;
            }
        }

        index = 0;
        for (let i = 0; i < (trip_points.length - 1); i++) {
            let pointList = [trip_points[i], trip_points[i + 1]];

            if (this.inner_props.use_fill) {
                if (av_delays[index] === null) {
                    this.putPathOnMap(pointList, null, null, null);
                } else {
                    this.putPathOnMap(pointList, av_delays[index], index, null);
                }
                if (i === stop_indexes[index]) {
                    index++;
                }
            } else {
                let count = 0, delay = 0;
                for (let j = 0; j < delays.length; j++) {
                    if (delays[j][i] !== null) {
                        delay += delays[j][i];
                        count++;
                    }
                }
                if (count === 0) {
                    this.putPathOnMap(pointList, null, null, null);
                } else {
                    this.putPathOnMap(pointList, Math.round(delay / count * 100) / 100, null,
                        Math.round(delay / count * 100) / 100);
                }
            }
        }

        let max = 0;

        for (let i = 0; i < summed_data.length; i++) {
            if (summed_data[i].data === null) {
                summed_data[i].data = 0;
            } else if (summed_data[i].data > max) {
                max = summed_data[i].data;
            }
        }
        for (let i = 0; i < summed_data.length; i++) {
            summed_data[i].data = summed_data[i].data / max * 100;
        }

        for (let i = 0; i < trip_stops.length; i++) {
            let point;

            point = L.circle([trip_stops[i].lat, trip_stops[i].lng], {
                color: "black",
                fillColor: "black",
                fillOpacity: 1,
                radius: 3.0,
            }).bindTooltip(trip_stops[i].name).openTooltip();

            point.addTo(path_layer);
        }

        this.ac_trip.av_delays = av_delays;
        this.ac_trip.sum_of_delays = summed_data;
        this.ac_trip.stop_stats = stats_data;
        this.updateControl();
    }

    // Základná inicializácia mapy a ovládacích prvkov
    componentDidMount() {
        if (this.map !== undefined) {
            return
        }

        this.map = L.map(this.state.id, {
            center: [49.195629, 16.613396],
            zoom: 13,
            layers: [
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png')
            ]
        });

        this.inner_props.path_layer = L.layerGroup();
        this.inner_props.details_layer = L.layerGroup();
        this.inner_props.path_layer.addTo(this.map);
        this.inner_props.details_layer.addTo(this.map);

        let t = this;

        this.map.on('click', function(event) {
            t.inner_props.details_layer.eachLayer(function (layer) {
                t.inner_props.details_layer.removeLayer(layer);
            });
        });

        let def_control = document.getElementsByClassName('leaflet-control-container');
        this.inner_elems.control = ReactDOM.createRoot(def_control[0]);

        this.setDefaults();
    }

    render() {
        return <div id={this.state.id} className={this.state.class}/>
    }
}

export default ReactMap;
