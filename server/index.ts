import { WebSocketServer, WebSocket } from 'ws';
import express, { Express, Request, Response } from 'express';
import https, { Server, RequestOptions } from 'https';
import path from 'path';
import events from 'events';
import fs from 'fs';
const cron = require('node-cron');
const CSV = require('csv-string');


const app: Express = express();
const server: Server = https.createServer({
  key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')),
  // requestCert: true,
  rejectUnauthorized: false
}, app);
const wss = new WebSocketServer({ server });
const ev = new events.EventEmitter();

const getOption: RequestOptions = {
  hostname: 'data.nhi.gov.tw',
  port: 443,
  path: '/resource/Nhi_Fst/Fstdata.csv',
  method: 'GET',
};

const getData: () => void = () => {
  let data = '';
  const req = https.request(getOption, (res) => {
    res.on('data', (d) => {
      const str = d.toString();
      data += str;
    });
    res.on('end', () => {
      const parse: Array<{}> = CSV.parse(data, { output: 'objects' });
      ev.emit('wsSend', parse);
    });
  })

  req.on('error', error => {
    console.error(error);
  });

  req.end();
}

// 5 分鐘取一次資料
cron.schedule(
  '*/5 * * * *',
  () => {
    console.log('emit after 5 mintues');
    getData();
  }, {
    scheduled: true,
  }
)

let gws: WebSocket | null  = null;

wss.on('connection', (ws: WebSocket) => {
  gws = ws;
  ws.on('message', (data) => {
    console.log(data.toString());
  });
  gws.send('1111');
});

ev.on('wsSend', (data) => {
  if (gws) {
    gws.send(JSON.stringify(data));
  }
});

app.use('/public', express.static(path.join(__dirname, 'public')))

server.listen(3000, () => {
  console.log('app listening at http://localhost:3000')
});

getData();

// 快篩即時資料 https://data.nhi.gov.tw/resource/Nhi_Fst/Fstdata.csv
