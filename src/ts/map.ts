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
let longitude: number;
let latitude: number;

// 設定地圖圖磚
leaflet.tileLayer(
  'https://wmts.nlsc.gov.tw/wmts/EMAP6/default/GoogleMapsCompatible/{z}/{y}/{x}',
  { maxZoom: 18, id: 'EMAP6' }
).addTo(map);

const markers: MarkerClusterGroup = leaflet.markerClusterGroup();
const allMarkersDataMap: { [key: string]: {} } = {};

dataJson.forEach((item) => {
  const lng:string = item['經度'];
  const lat:string = item['緯度'];
  const marker: Marker = leaflet.marker([Number(lat), Number(lng)], {
    title: item['醫事機構名稱'],
  });
  marker.bindPopup(`<h3>${item['醫事機構名稱']}</h3><p>快篩剩餘數量：${item['快篩試劑截至目前結餘存貨數量']}</p>`);
  marker.on('click', (e) => {
    const dialog = document.getElementById('dialog');
    const isDialogOpen: boolean = dialog!.classList.contains('is-active');
    if (!isDialogOpen) {
      dialog!.classList.add('is-active');
    }
    // !. 是告訴 typescript，document.getElementById('title') 不會是 null 或 undefined
    document.getElementById('title')!.textContent = item['醫事機構名稱'];
    document.getElementById('brand')!.textContent = item['廠牌項目'];
    document.getElementById('num')!.textContent = item['快篩試劑截至目前結餘存貨數量'];
    document.getElementById('address')!.textContent = item['醫事機構地址'];
    document.getElementById('tel')!.textContent = item['醫事機構電話'];
    document.getElementById('tips')!.textContent = item['備註'];
    document.getElementById('time')!.textContent = item['來源資料時間'];
    const aLink = document.getElementById('googlemap') as HTMLAnchorElement;
    // https://developers.google.com/maps/documentation/urls/get-started
    aLink.href = `https://www.google.com/maps/dir/?api=1&origin${latitude},${longitude}&destination=${lat},${lng}&travelmode=driving`
  });
  allMarkersDataMap[item['醫事機構名稱']] = item;
  markers.addLayer(marker);
});

map.addLayer(markers);

navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
  longitude = position.coords.longitude;
  latitude = position.coords.latitude;
  const circle: Circle = leaflet.circle([latitude, longitude], {
    radius: 20,
    color: 'red',
    fillOpacity: 0.5,
  }).addTo(map);
  map.setView([latitude, longitude], 15);
  document.querySelector('.loading-container')!.classList.add('is-inactive');
}, () => {
  console.log('whooppppps error');
  document.querySelector('.loading-container')!.classList.add('is-inactive');
});

// leaf cluster
// https://github.com/Leaflet/Leaflet.markercluster
