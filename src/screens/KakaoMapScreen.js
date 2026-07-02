import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
let Location = null;
try { Location = require('expo-location'); } catch (_) {}

const REST_KEY = '61ab42ac0a57cd172625698b308745e9';
const JS_KEY   = '2c63d05e29a82802c023313a723a8c65';

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function searchPlace(query) {
  const r = await fetch(
    'https://dapi.kakao.com/v2/local/search/keyword.json?query='
      + encodeURIComponent(query) + '&size=1',
    { headers: { Authorization: 'KakaoAK ' + REST_KEY } }
  );
  const data = await r.json();
  if (data.documents?.length > 0) {
    return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
  }
  return null;
}

async function fetchRoute(dep, dest) {
  const url = `https://router.project-osrm.org/route/v1/driving/`
    + `${dep.lng},${dep.lat};${dest.lng},${dest.lat}`
    + `?overview=full&geometries=geojson`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.code === 'Ok' && data.routes?.[0]) {
    const route = data.routes[0];
    const coords = route.geometry.coordinates; // [[lng, lat], ...]
    return {
      path: coords.map(c => ({ lng: c[0], lat: c[1] })),
      distKm: route.distance / 1000,
      durationMin: Math.ceil(route.duration / 60),
    };
  }
  return null;
}

function buildHtml(dep, dest, path, userLocation) {
  const pathJson = JSON.stringify(path.map(p => [p.lat, p.lng]));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:#f0f0f0;}
#map{position:absolute;top:0;left:0;right:0;bottom:0;}
</style>
</head>
<body>
<div id="map"></div>
<script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}"></script>
<script>
var DEP=[${dep.lat},${dep.lng}];
var DEST=[${dest.lat},${dest.lng}];
var PATH=${pathJson};

var map=new kakao.maps.Map(document.getElementById('map'),{
  center:new kakao.maps.LatLng((DEP[0]+DEST[0])/2,(DEP[1]+DEST[1])/2),
  level:7
});

function makeLabel(lat,lng,text,bg){
  new kakao.maps.CustomOverlay({
    map:map,
    position:new kakao.maps.LatLng(lat,lng),
    content:'<div style="background:'+bg+';color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);">'+text+'</div>',
    yAnchor:2.2,
  });
}
makeLabel(DEP[0],DEP[1],'출발','#2563EB');
makeLabel(DEST[0],DEST[1],'도착','#EF4444');

${userLocation ? `
new kakao.maps.CustomOverlay({
  map:map,
  position:new kakao.maps.LatLng(${userLocation.lat},${userLocation.lng}),
  content:'<div style="width:16px;height:16px;background:#3B82F6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25);"></div>',
  yAnchor:0.5,
});
` : ''}

if(PATH.length>1){
  var linePath=PATH.map(function(p){return new kakao.maps.LatLng(p[0],p[1]);});
  new kakao.maps.Polyline({
    map:map,path:linePath,
    strokeWeight:6,strokeColor:'#2563EB',strokeOpacity:0.85,strokeStyle:'solid'
  });
  var bounds=new kakao.maps.LatLngBounds();
  linePath.forEach(function(p){bounds.extend(p);});
  map.setBounds(bounds);
}
</script>
</body>
</html>`;
}

export default function KakaoMapScreen({ route }) {
  const { departure, destination } = route.params;

  const [status,       setStatus]       = useState('출발지 검색 중...');
  const [mapData,      setMapData]      = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [error,        setError]        = useState(null);

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
        let distKm = haversineKm(dep, dest) * 1.3;
        let durationMin = Math.ceil(distKm / 30 * 60);

        try {
          const rd = await fetchRoute(dep, dest);
          if (rd) {
            path = rd.path;
            distKm = rd.distKm;
            durationMin = rd.durationMin;
          }
        } catch (_) {}

        if (path.length === 0) path = [dep, dest];

        // 현재 위치 가져오기 (모듈 없거나 권한 없으면 무시)
        if (Location) {
          try {
            const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
            if (locStatus === 'granted') {
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              if (!cancelled) setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
          } catch (_) {}
        }

        if (!cancelled) setMapData({ dep, dest, path, distKm, durationMin });
      } catch (e) {
        if (!cancelled) setError('오류: ' + e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [departure, destination]);

  const html = useMemo(() => {
    if (!mapData) return null;
    return buildHtml(mapData.dep, mapData.dest, mapData.path, userLocation);
  }, [mapData, userLocation]);

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
        source={{ html, baseUrl: 'https://joong159.github.io' }}
        style={styles.webview}
        javaScriptEnabled
        scrollEnabled={false}
        originWhitelist={['*']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  webview:    { flex: 1 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  statusText: { marginTop: 14, fontSize: 14, color: '#374151' },
  errorText:  { fontSize: 14, color: '#EF4444', textAlign: 'center', lineHeight: 22 },
});
