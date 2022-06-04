import { WebSocketServer, WebSocket } from 'ws';
import { Express, Request, Response } from 'express';
import * as https from 'https';
import * as http from 'http';
import { Server, RequestOptions } from 'http';
import * as path from 'path';
import * as events from 'events';
import * as fs from 'fs';
const express = require('express');
const cron = require('node-cron');
const CSV = require('csv-string');

const isDev = process.env.NODE_ENV === 'development';
const app: Express = express();
let server = null;

if (isDev) {
  server = https.createServer({
    key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')),
    requestCert: false,
    rejectUnauthorized: false
  }, app);
} else {
  server = http.createServer({}, app);
}

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
  const protocol = isDev ? https : http;
  const req = protocol.request(getOption, (res) => {
    res.on('data', (d) => {
      const str = d.toString();
      data += str;
    });
    res.on('end', () => {
      const parse: Array<{}> = CSV.parse(data, { output: 'objects' });
      if (isDev) {
        fs.writeFile(path.resolve(__dirname, 'public/data.json'), JSON.stringify(parse), (error) => {});
      }
      else {
        fs.writeFile('/tmp/data.json', JSON.stringify(parse), (error) => {});
      }
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
});

ev.on('wsSend', (data) => {
  if (gws) {
    gws.send(JSON.stringify(data));
  }
});

app.use('/public', express.static(path.join(__dirname, 'public')));
app.get('/data', (req, res) => {
  if (isDev) {
    try {
      const data = fs.readFileSync(path.resolve(__dirname, 'public/data.json'));
      res.status(200).json({ success: true, data: JSON.parse(data.toString()) });
    } catch(err) {
      console.log(err);
      res.status(500).json({ success: false });
    }
  } else {
    try {
      const data = fs.readFileSync('/tmp/data.json');
      res.status(200).json({ success: true, data: JSON.parse(data.toString()) });
    } catch(err) {
      console.log(err);
      res.status(500).json({ success: false });
    }
  }
});
app.get('*', (req, res) => {
  res.redirect('/public/map.html')
});

server.listen(process.env.PORT || 3000, () => {
  if (isDev) {
    console.log('app listening at https://localhost:3000')
  }
});

getData();

// 快篩即時資料 https://data.nhi.gov.tw/resource/Nhi_Fst/Fstdata.csv
