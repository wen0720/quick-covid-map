import leaflet, { Map, Circle, Marker, MarkerClusterGroup } from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import dataJson from '../data.json';

const socket: WebSocket = new WebSocket('wss://localhost:3000');

socket.addEventListener('open', (event: Event) => {
  socket.send('hello server');
});

socket.addEventListener('message', (event: MessageEvent<string>) => {
  const test = event.data;
  console.log(test);
});

const map: Map = leaflet.map('map').setView([23.5, 121], 7);

console.log(dataJson);

// 設定地圖圖磚
leaflet.tileLayer(
  'https://wmts.nlsc.gov.tw/wmts/EMAP6/default/GoogleMapsCompatible/{z}/{y}/{x}',
  { maxZoom: 18, id: 'EMAP6' }
).addTo(map);

const markers: MarkerClusterGroup = leaflet.markerClusterGroup();

dataJson.forEach((item) => {
  const lng:string = item['經度'];
  const lat:string = item['緯度'];
  const marker: Marker = leaflet.marker([Number(lat), Number(lng)], {
    title: item['醫事機構名稱'],
  });
  marker.bindPopup(`<h1>${item['醫事機構名稱']}</h1>`);
  markers.addLayer(marker);
});

map.addLayer(markers);

navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
  console.log(position);
  const { longitude, latitude }: { longitude: number, latitude: number } = position.coords;
  const circle: Circle = leaflet.circle([latitude, longitude], {
    radius: 20,
    color: 'red',
    fillOpacity: 0.5,
  }).addTo(map);
  map.setView([latitude, longitude], 15);
}, () => {
  console.log('whooppppps error');
});

// leaf cluster
// https://github.com/Leaflet/Leaflet.markercluster
