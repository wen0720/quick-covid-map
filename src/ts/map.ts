import leaflet, { Map, Circle, Marker, MarkerClusterGroup } from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { io } from 'socket.io-client';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithPopup, signInWithRedirect,
  getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithCredential,
  signOut } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot,
  updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';

type itemType = {
  '來源資料時間': string;
  '備註': string;
  '廠牌項目': string;
  '快篩試劑截至目前結餘存貨數量': string;
  '經度': string;
  '緯度': string;
  '醫事機構名稱': string;
  '醫事機構地址': string;
  '醫事機構電話': string;
  '醫事機構代碼': string;
}

type user = {
  hospitals: string[];
  uid: string;
  name: string;
}

const wsUrl = process.env.NODE_ENV === 'development'
  ? 'localhost:3000'
  : window.location.host

const socket = io(`wss://${wsUrl}`);

const map: Map = leaflet.map('map').setView([23.5, 121], 7);
let longitude: number;
let latitude: number;
let nowItem: itemType;
const markers: MarkerClusterGroup = leaflet.markerClusterGroup();
let nowUserListIds: string[] = [];
const allMarkersDataMap: { [key: string]: itemType } = {};
const pharmacyIcon = leaflet.icon({
  iconUrl: require('img/pharmacy.png'),
  iconSize: [36, 36],
  shadowUrl: require('img/pharmacy-shadow.png'),
  shadowSize: [40, 17],
  shadowAnchor: [15, 0],
  popupAnchor:  [0, -10]
});
const manIcon = leaflet.icon({
  iconUrl: require('img/man.png'),
  iconSize: [60, 60],
});

const setDialogContent: (userLng: number, userLat: number, item: itemType) => void = (userLng, userLat, item) => {
  const lng:string = item['經度'];
  const lat:string = item['緯度'];
  // !. 是告訴 typescript，document.getElementById('title') 不會是 null 或 undefined
  document.getElementById('title')!.textContent = item['醫事機構名稱'];
  document.getElementById('brand')!.textContent = item['廠牌項目'];
  document.getElementById('num')!.textContent = item['快篩試劑截至目前結餘存貨數量'];
  document.getElementById('address')!.textContent = item['醫事機構地址'];
  document.getElementById('tel')!.textContent = item['醫事機構電話'];
  document.getElementById('tips')!.textContent = item['備註'];
  document.getElementById('time')!.textContent = item['來源資料時間'];
  if (nowUserListIds.indexOf(item['醫事機構代碼']) > -1) {
    document.getElementById('addToList')?.classList.add('disabled');
  } else {
    document.getElementById('addToList')?.classList.remove('disabled');
  }
  const aLink = document.getElementById('googlemap') as HTMLAnchorElement;
  // https://developers.google.com/maps/documentation/urls/get-started
  aLink.href = `https://www.google.com/maps/dir/?api=1&origin${userLat},${userLng}&destination=${lat},${lng}&travelmode=driving`
}
const setMarker: (item: any) => Marker = (item) => {
  const lng:string = item['經度'];
  const lat:string = item['緯度'];
  const marker: Marker = leaflet.marker([Number(lat), Number(lng)], {
    title: item['醫事機構名稱'],
    icon: pharmacyIcon,
  });
  marker.bindPopup(`<h3>${item['醫事機構名稱']}</h3><p>快篩剩餘數量：${item['快篩試劑截至目前結餘存貨數量']}</p>`);
  marker.on('click', (e) => {
    nowItem = item;
    const dialog = document.getElementById('dialog');
    const isDialogOpen: boolean = dialog!.classList.contains('is-active');
    if (!isDialogOpen) {
      dialog!.classList.add('is-active');
    }
    setDialogContent(longitude, latitude, item);
  });
  return marker;
}

const getPharmacyAndSetMap = () => {
  const apiPrefix = process.env.NODE_ENV === 'development' ? '/api' : '';
  axios.get(`${apiPrefix}/data`)
    .then((res) => {
      const dataJson = res.data.data;
      dataJson.forEach((item: itemType) => {
        const newItem: itemType | any = {};
        Object.keys(item).forEach((key: keyof itemType | string) => {
          // Zero Width No-Break Space
          // 後端寫檔案進去時，有一個 key(醫事機構代碼) 多了 Zero Width No-Break Space
          // unicode 10 進位:65279，16 進位：feff
          const newKey = key.replace(/\ufeff/g, '');
          newItem[newKey] = (item as any)[key];
        });
        const marker = setMarker(newItem);
        allMarkersDataMap[newItem['醫事機構代碼']] = newItem;
        markers.addLayer(marker);
      });
      map.addLayer(markers);
    })
    .catch((error) => {
      window.alert('取得資料失敗');
    });
}

const getGspAndSetMap = () => {
  document.querySelector('.loading-container')!.classList.remove('is-inactive');
  document.getElementById('loadingText')!.textContent = '自動定位中';
  return new Promise<void>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
      const { accuracy } = position.coords;
      if (accuracy < 20) {
        longitude = position.coords.longitude;
        latitude = position.coords.latitude;
      } else {
        window.alert('定位異常，您將被定位在台北 101');
        longitude = 121.564128;
        latitude = 25.03369;
      }
      const marker: Marker = leaflet.marker([latitude, longitude], {
        title: '現在位置',
        icon: manIcon,
      }).addTo(map);
      marker.bindPopup('現在位置').openPopup();
      map.setView([latitude, longitude], 15);
      document.querySelector('.loading-container')!.classList.add('is-inactive');
      resolve();
    }, () => {
      console.log('whooppppps error');
      document.querySelector('.loading-container')!.classList.add('is-inactive');
      resolve();
    });
  });
}

socket.on('data', (msg) => {
  markers.clearLayers();

  msg.forEach((item: any) => {
    const marker = setMarker(item);
    allMarkersDataMap[item['醫事機構代碼']] = item;
    markers.addLayer(marker);
  });

  const nowDialogTitle: string = document.getElementById('title')!.textContent || '';
  setDialogContent(longitude, latitude, allMarkersDataMap[nowDialogTitle]);
});

// 設定地圖圖磚
leaflet.tileLayer(
  'https://wmts.nlsc.gov.tw/wmts/EMAP6/default/GoogleMapsCompatible/{z}/{y}/{x}',
  { maxZoom: 18, id: 'EMAP6' }
).addTo(map);


document.querySelector('.map-dialog-title-close')!.addEventListener('click', () => {
  document.getElementById('dialog')!.classList.remove('is-active');
});

function animationTillEndByClass(target:HTMLElement, classText:string, type: boolean = true): Promise<void> {
  let resolveTemp: (() => void) | null = null;
  return new Promise<HTMLElement>((resolve) => {
    resolveTemp = resolve.bind(null, target);
    target.addEventListener('transitionend', resolveTemp);
    if (type) {
      target.classList.add(classText);
    } else {
      target.classList.remove(classText);
    }
  }).then((target) => {
    target.removeEventListener('transitionend', resolveTemp as () => void);
  })
};

const firebaseConfig = {
  apiKey: "AIzaSyA2mJJkqFFilVUC47Dys-ZAMG68M-JlYrY",
  authDomain: "project-4c5bf.firebaseapp.com",
  databaseURL: "https://project-4c5bf.firebaseio.com",
  projectId: "project-4c5bf",
  storageBucket: "project-4c5bf.appspot.com",
  messagingSenderId: "379694882039",
  appId: "1:379694882039:web:ed275ba28e8e87476b87f2",
  measurementId: "G-KH9HVYP6V3"
};

let init = true;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/user.gender.read');
provider.setCustomParameters({
  prompt: 'select_account',
});
const signInPopup: () => void = () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      const user = result.user;
      console.log(token, user);
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      const email = error.customData.email;
    });
}
const signInRedirect: () => void = () => {
  signInWithRedirect(auth, provider).catch((error) => {
    console.log(error);
  });
};

declare global {
  interface Window {
    google: any;
  }
}

getPharmacyAndSetMap();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 想在已經確定登入之後做的事
    const { displayName } = user;
    if (displayName) {
      document.getElementById('name')!.textContent = displayName;
    }
  } else {
    document.getElementById('name')!.textContent = '未登入';
  }

  if (init) {
    if (user) {
      // 初次載入已登入
      await getGspAndSetMap();
    } else {
      // show 登入 popup
      document.getElementById('login-dialog')!.classList.remove('is-inactive');
      document.getElementById('login-dialog')!.classList.add('is-active');

      // google one tap sign in
      window.google.accounts.id.initialize({
        client_id: '379694882039-humq2ch6mf9unuk3dprb36sioed930aj.apps.googleusercontent.com',
        itp_support: true,
        callback: (response:any) => {
          const credential = GoogleAuthProvider.credential(response.credential);
          signInWithCredential(auth, credential)
            .then((res) => {
              console.log(res);
            })
            .catch((error) => {
              console.log(error);
            });
        },
      });
      window.google.accounts.id.prompt((notification: any) => {
        console.log(notification);
      });
    }
    init = false;
  }

  if (user) {
    // 使用者登錄中
    document.getElementById('login-dialog')!.classList.add('is-inactive');
    document.getElementById('login-dialog')!.classList.remove('is-active');
    document.querySelector('.loading-container')!.classList.add('is-inactive');

    document.getElementById('googleLogout')!.classList.remove('d-none')
    document.getElementById('googleLogin')!.classList.add('d-none')
    const { uid, displayName } = user;
    const usersRef = collection(db, 'users');
    const userDocRef = doc(usersRef, uid);
    onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const { hospitals }: user = doc.data() as user;
        nowUserListIds = [...hospitals];
        if (hospitals.length === 0) {
          document.getElementById('hos-list')!.innerHTML = '';
          return;
        }
        const html = hospitals.map((hospitalId) => {
          const item = allMarkersDataMap[hospitalId];
          const lat = item['緯度'];
          const lng = item['經度'];
          const telString = item['醫事機構電話'].replace(/(\(|\))/g, '').slice(1);
          const tel = `+886-${telString[0]}-${telString.slice(1)}`;
          const addressUrl = `https://www.google.com/maps/dir/?api=1&origin${latitude},${longitude}&destination=${lat},${lng}&travelmode=driving`;
          return `
            <li>
              <div class="list-close" data-closeKey="${item['醫事機構代碼']}"></div>
              <div class="list-title">
                <span>${item['醫事機構名稱']}</span>
                <a href="tel:${tel}">
                  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAC3UlEQVRoge2YTWgTQRiGn9lgrfUPEYqKCHoXlArSCupF8NCCBy8etIdSWrulaoQ2iSABaZO0iiJNYixS8aAieBFE7FWpWIpeREHRgx5K9CDUv9ra/bxUTWKy2U0mEcs+kEPenf3mfTM72ZkBDw8PD48yULZX49EWFJeBdTat3iLSjhkc0+rMIUaRqwnszQNsQqlRbY5cYh9A2OiwzobyrZSGfYD/gEUfwKqKizIoFuBjVVyUQbFJ/KFKPkrGPoDiVZV8lEyxAONV8lEyReaA9cBZGRUq30pp2AdIzz4C9c6mhSDip6svoteWc+wDhMMWcL3A1XlEtWMGz2t35YLiLzKfGgF+5KhziBzG7LtSEVcuKB6go/c1cDNHfYYZvFERRy5xtpQQNUD2KGwnMbinIo5c4iyA2fcCRTxbtEaJh1dUwJMrnC/m5mZOA1MZymZU7QXtjlziPEBPeBpoAyRDbSMePabblBvcLae7AveA4SxNcY7kYLNGT65wvx9YNtOLMJmh+BDrFsnIXn22nGO/qS9Eqn89lm8iZ8v5CcvaR3fosR5rzihtR9ZxagrLaAGmM9SVGMYYw9HdWpw5pLQR+EU82oTiPpD5d/oVOLgwXwqTiIaA/oVvs8CXPK3eIBzHDDwsVKa8PbEZGAejGficodYBd0hEzYL3JWM9/DEPUAOsyfNpQHHNzkJ5I/CLS7EdWHIXqM/ShRTfa07g93/7rcVjbSgZcdV3V6BgWz2nEp19k/iMJuBllq7ooHb2KcmBXQDEI4dQkkLXD6ezEACp6GrmuQocyNPTE4StwBLXdW1GQG8AABFFInYSxRmgVkvNij9CmSglmIGzGFYDMKG9fg6VO5nrDD3n/UwjQitCulLd6H+E8nExvArfUj9KdQNrXd9f1Tlgx9DQcuqsVpQcAXY6ukdIYwYKHvFXN0AmicgWxNiPkkZQ20Dq+fs9ksYQk6PB2//GpIeHh8ei5yePyK8E5ckfwQAAAABJRU5ErkJggg=="/>
                </a>
                <a target="_blank" href="${addressUrl}">
                  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABmJLR0QA/wD/AP+gvaeTAAABsklEQVRIie3WQUsVURjG8Z8RboIugV2KdJlIS6VNLZJokUUr6zv4Da4t2qgfILfivi8QFuEiglaFCq3atQhdmhcTzNAWcwZG75mZe8cZaOEDL2eY5z3n/87cO+e8XKia2ljCJvZDbGAxeI3oBbo4yYkunjcBPS6ApnFcBv+An1jFLFoFuW3FT3o29nA9b7GzyUf4iA7uYQo3Qu7SANA0FsrA8wF4FJk8FXK3It5b3MIo1iL+Rhk4VUvyylcz3tXgxV7zaGbuWMTv9gsu8n5VAO/WAf4aWXgtwMfwLuJ/qQP8MrJwWXTqALckn16/0G1cqwMMj3DYB/QQD/OgVcDwRPKnyYPu4nERtCoYxsW/603cDjkjTYBhWLKBZDeT4eBN4kcT4LthbOMAv53elw9Kiq4M/o4r4XoZrweYey7wCVYqrntucNHCPf6loiqa1H8D3g9jPx1I9shM9QZzmBi0kFdO91BpBzKfudeR3yRkYydTSM9vPBSB38EzzOA+LucU+Ref8R6f8EfSnUzjAW5G5gz1XOSoJTkIZsII65Kzdl3SwOVpIhQwHR7gG56W8C5Uv/4BUD4M7Kcz/I0AAAAASUVORK5CYII="/>
                </a>
              </div>
              <div class="list-num">
                剩餘<span> ${item['快篩試劑截至目前結餘存貨數量']} </span>個
              </div>
              <div class="list-address">地址：${item['醫事機構地址']}</div>
              <div class="list-remark">備註：${item['備註']}</div>
            </li>
          `
        }).join('');
        document.getElementById('hos-list')!.innerHTML = html;
        document.querySelectorAll<HTMLElement>('.list-close').forEach((el) => {
          el.addEventListener('click', () => {
            console.log('click');
            if (auth.currentUser) {
              updateDoc(userDocRef, {
                hospitals: arrayRemove(el.dataset.closekey),
              });
            }
          });
        });
      } else {
        setDoc(userDocRef, {
          name: displayName,
          hospitals: [],
          uid,
        }).catch((error) => console.log(error));
      }
    });
  } else {
    document.getElementById('googleLogout')!.classList.add('d-none')
    document.getElementById('googleLogin')!.classList.remove('d-none')
  }
});


let isMenudoing = false;
document.querySelector('.profile-btn')!.addEventListener('click', () => {
  if (isMenudoing) {
    return;
  }
  const menuEl: HTMLElement | null = document.querySelector('.profile-menu');
  if (!menuEl!.classList.contains('is-active')) {
    console.log('active');
    isMenudoing = true;
    menuEl!.classList.add('d-block');
    window.requestAnimationFrame(() => {
      animationTillEndByClass(menuEl as HTMLElement, 'is-active')
        .then(() => {
          isMenudoing = false;
        });
    });
  } else {
    isMenudoing = true;
    animationTillEndByClass(menuEl as HTMLElement, 'is-active', false)
      .then(() => {
        menuEl!.classList.remove('d-block');
        isMenudoing = false;
      });
  }
});

document.getElementById('googleLogin')!.addEventListener('click', () => {
  signInRedirect();
});

document.getElementById('loginWaitBtn')!.addEventListener('click', () => {
  document.getElementById('login-dialog')!.classList.remove('is-active');
  document.getElementById('login-dialog')!.classList.add('is-inactive');
  getGspAndSetMap();
});

document.getElementById('loginGoBtn')!.addEventListener('click', () => {
  signInRedirect();
});

document.getElementById('googleLogout')!.addEventListener('click', () => {
  signOut(auth).then(() => {
    console.log('登出成功');
    document.getElementById('hos-list')!.innerHTML = '';
  }).catch(() => {
    console.log('登出失敗');
  });
});

// 查看清單
document.getElementById('showList')!.addEventListener('click', () => {
  document.getElementById('hos-list-wrapper')!.classList.add('is-active');
});

// 加入清單
document.getElementById('addToList')!.addEventListener('click', async () => {
  if (auth.currentUser) {
    if (nowUserListIds.indexOf(nowItem['醫事機構代碼']) > -1) {
      return;
    }
    const postData = {
      hospitalName: nowItem['醫事機構名稱'],
      hospitalId: nowItem['醫事機構代碼'],
    };
    const userDocRef = doc(db, `users/${auth.currentUser.uid}`);
    updateDoc(userDocRef, {
      hospitals: arrayUnion(nowItem['醫事機構代碼']),
    }).catch((error) => {
      console.log(error);
    });

    const hosDocRef = doc(db, 'hospitals', nowItem['醫事機構代碼']);
    const hosDocSnap = await getDoc(hosDocRef);
    if (!hosDocSnap.exists()) {
      console.log('不存在');
      setDoc(hosDocRef, postData)
        .then(() => {
          document.getElementById('addToList')!.classList.add('disabled');
          alert('清單加入成功');
        }).catch((error) => {
          console.log(error);
        });
    }
  }
});

// 點擊地圖時把 menu 和 清單 關掉
document.getElementById('map')!.addEventListener('click', () => {
  const menuEl = document.querySelector('.profile-menu') as HTMLElement;
  if (menuEl.classList.contains('is-active')) {
    isMenudoing = true;
    animationTillEndByClass(menuEl as HTMLElement, 'is-active', false)
      .then(() => {
        menuEl!.classList.remove('d-block');
        document.getElementById('hos-list-wrapper')!.classList.remove('is-active');
        isMenudoing = false;
      });
  }
});


// leaf cluster
// https://github.com/Leaflet/Leaflet.markercluster
