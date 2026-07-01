import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const REST_KEY = '12d2315e45f31eea37e639a1979a963b';

async function searchPlace(query) {
  const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?query='
    + encodeURIComponent(query) + '&size=1';
  const r = await fetch(url, { headers: { Authorization: 'KakaoAK ' + REST_KEY } });
  const data = await r.json();
  if (data.documents && data.documents.length > 0) {
    return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
  }
  return null;
}

async function fetchRoute(dep, dest) {
  const url = 'https://apis-navi.kakao.com/v1/directions'
    + '?origin=' + dep.lng + ',' + dep.lat
    + '&destination=' + dest.lng + ',' + dest.lat
    + '&priority=RECOMMEND';
  const r = await fetch(url, { headers: { Authorization: 'KakaoAK ' + REST_KEY } });
  return r.json();
}

function buildHtml(dep, dest, path, summary, depName, destName, farePerPerson) {
  const distText = summary.distance ? (summary.distance / 1000).toFixed(1) + ' km' : '-';
  const durText  = summary.duration ? Math.ceil(summary.duration / 60) + ' 분' : '-';
  const fareText = farePerPerson > 0 ? '약 ' + farePerPerson.toLocaleString('ko-KR') + '원' : '';

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{display:flex;flex-direction:column;height:100vh;background:#EFF6FF;font-family:-apple-system,sans-serif;}
canvas{flex:1;width:100%;}
#card{background:#fff;padding:16px 20px;border-top:1px solid #E5E7EB;}
.title{font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;}
.row{display:flex;justify-content:space-between;margin-top:5px;}
.lbl{font-size:12px;color:#9CA3AF;}
.val{font-size:12px;font-weight:600;color:#374151;}
.fare{font-size:14px;font-weight:700;color:#059669;}
</style></head><body>
<canvas id="c"></canvas>
<div id="card">
  <div class="title">${depName} → ${destName}</div>
  <div class="row"><span class="lbl">거리</span><span class="val">${distText}</span></div>
  <div class="row"><span class="lbl">예상 시간</span><span class="val">${durText}</span></div>
  ${fareText ? '<div class="row"><span class="lbl">예상 1인 부담</span><span class="fare">' + fareText + '</span></div>' : ''}
</div>
<script>
var PATH=${JSON.stringify(path)};
var DEP=${JSON.stringify(dep)};
var DEST=${JSON.stringify(dest)};
var c=document.getElementById('c');
var ctx=c.getContext('2d');
function draw(){
  var W=c.width=c.offsetWidth,H=c.height=c.offsetHeight;
  var pts=PATH.length>1?PATH:[DEP,DEST];
  var minLa=1e9,maxLa=-1e9,minLg=1e9,maxLg=-1e9;
  pts.forEach(function(p){
    if(p.lat<minLa)minLa=p.lat;if(p.lat>maxLa)maxLa=p.lat;
    if(p.lng<minLg)minLg=p.lng;if(p.lng>maxLg)maxLg=p.lng;
  });
  var pad=48,sLa=maxLa-minLa||0.005,sLg=maxLg-minLg||0.005;
  var sc=Math.min((W-pad*2)/sLg,(H-pad*2)/sLa);
  function xy(p){return{x:pad+(p.lng-minLg)*sc,y:H-pad-(p.lat-minLa)*sc};}
  ctx.fillStyle='#EFF6FF';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#BFDBFE';ctx.lineWidth=1;
  for(var gx=0;gx<W;gx+=36){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(var gy=0;gy<H;gy+=36){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
  if(pts.length>1){
    ctx.beginPath();
    var f=xy(pts[0]);ctx.moveTo(f.x,f.y);
    for(var i=1;i<pts.length;i++){var q=xy(pts[i]);ctx.lineTo(q.x,q.y);}
    ctx.strokeStyle='#2563EB';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
  }
  function dot(p,color,label){
    var pos=xy(p);
    ctx.beginPath();ctx.arc(pos.x,pos.y,10,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle=color;ctx.font='bold 12px -apple-system,sans-serif';
    ctx.fillText(label,pos.x+15,pos.y+5);
  }
  dot(DEP,'#2563EB','출발');
  dot(DEST,'#EF4444','도착');
}
draw();
window.addEventListener('resize',draw);
</script></body></html>`;
}

export default function KakaoMapScreen({ route }) {
  const { departure, destination, estimatedFare = 0, capacity = 4 } = route.params;
  const farePerPerson = estimatedFare > 0 && capacity > 0 ? Math.ceil(estimatedFare / capacity) : 0;

  const [status, setStatus] = useState('출발지 검색 중...');
  const [mapData, setMapData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus('출발지 검색 중...');
        const dep = await searchPlace(departure);
        if (cancelled) return;
        if (!dep) { setError('출발지를 찾을 수 없어요\n"' + departure + '"'); return; }

        setStatus('목적지 검색 중...');
        const dest = await searchPlace(destination);
        if (cancelled) return;
        if (!dest) { setError('목적지를 찾을 수 없어요\n"' + destination + '"'); return; }

        setStatus('경로 계산 중...');
        let path = [];
        let summary = {};
        try {
          const rd = await fetchRoute(dep, dest);
          if (rd.routes && rd.routes[0] && rd.routes[0].result_code === 0) {
            summary = rd.routes[0].summary;
            rd.routes[0].sections.forEach(sec => {
              sec.roads.forEach(road => {
                const v = road.vertexes;
                for (let i = 0; i < v.length - 1; i += 2)
                  path.push({ lat: v[i + 1], lng: v[i] });
              });
            });
          }
        } catch (_) {}

        if (path.length === 0) path = [dep, dest];
        if (!cancelled) setMapData({ dep, dest, path, summary });
      } catch (e) {
        if (!cancelled) setError('검색 오류: ' + e.message);
      }
    })();

    return () => { cancelled = true; };
  }, [departure, destination]);

  const html = useMemo(() => {
    if (!mapData) return null;
    const { dep, dest, path, summary } = mapData;
    return buildHtml(dep, dest, path, summary, departure, destination, farePerPerson);
  }, [mapData]);

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!html) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <WebView
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        scrollEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  statusText: { marginTop: 14, fontSize: 14, color: '#374151' },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', lineHeight: 22 },
});
