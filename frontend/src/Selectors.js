/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

import React, { Component } from 'react';
import { Dropdown } from 'primereact/dropdown';
import 'primereact/resources/primereact.css';

//  Trieda hlavných selektorov pre výber linky, trasy a spoja
export class Selectors extends Component {

    constructor(props) {
        super(props);

        this.state = {
            selected_line: null,
            selected_route: null,
            selected_trip: null
        };

        this.onLineSelect = this.onLineSelect.bind(this);
        this.onRouteSelect = this.onRouteSelect.bind(this);
        this.onTripSelect = this.onTripSelect.bind(this);
    }

    onLineSelect(e) {
        this.props.selectLine(e.value.code);
    }

    onRouteSelect(e) {
        this.props.selectRoute(e.value.code);
    }

    onTripSelect(e) {
        this.props.selectTrip(e.value);
    }

    render() {
        let line = null, routes = null, trips = null;
        let route = null, trip = null;

        if (this.props.data.lines.length > 0) {
            line = this.props.data.lines[this.props.selected.line];
            routes = this.props.data.routes[line.code];
            if (routes !== undefined) {
                route = routes[this.props.selected.route];
                trips = this.props.data.trips[this.props.data.routes[line.code][this.props.selected.route].code];
                if (trips !== undefined) {
                    trip = trips[this.props.selected.trip];
                }
            }
        }
        return ([
            <div className="s_main_div" key='0' onClick={event => event.stopPropagation()}
                 onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
                 onScroll={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>

                <Dropdown disabled={this.props.enabled} filter value={line} options={this.props.data.lines}
                          onChange={this.onLineSelect} placeholder='Zvolte linku' optionLabel="name"/>
                <Dropdown disabled={this.props.enabled}filter value={route} options={routes}
                          onChange={this.onRouteSelect} placeholder='Zvolte trasu' optionLabel="name"/>
                <Dropdown disabled={this.props.enabled} filter value={trip} options={trips}
                          onChange={this.onTripSelect} placeholder='Zvolte spoj' optionLabel="dep_time"/>
            </div>
            ]);
    }
}