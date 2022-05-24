import leaflet from 'leaflet';

const socket: WebSocket = new WebSocket('wss://localhost:3000');

socket.addEventListener('open', (event: Event) => {
  socket.send('hello server');
});

socket.addEventListener('message', (event: MessageEvent<string>) => {
  console.log(event.data);
});

const map = leaflet.map('map').setView([23.5, 121], 7);

// 設定地圖圖磚
leaflet.tileLayer(
  'https://wmts.nlsc.gov.tw/wmts/EMAP6/default/GoogleMapsCompatible/{z}/{y}/{x}',
  { maxZoom: 18, id: 'EMAP6' }
).addTo(map);
