import React from 'react';
import ReactMapGL from 'react-map-gl';

export default function Mapweb() {
    const [viewport, setViewport] = React.useState({
        latitude: 42.7302,
        longitude: -73.6788,
        zoom: 10,
        width: '100vw',
        height: '100vh'
    });
    return (
        <ReactMapGL
            {...viewport}
            mapboxApiAccessToken= "pk.eyJ1IjoiamVyb2xkYjI2IiwiYSI6ImNtbDJya3F1eDBsdmEzZXB2anZwenIyZWsifQ.sfgcWkKJzOxdJ8ANh7gseg"
            onViewportChange={next => setViewport(next)}
        />
    );
}