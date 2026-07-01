import React, { useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const KAKAO_JS_KEY = '12d2315e45f31eea37e639a1979a963b';
const KAKAO_REST_KEY = '12d2315e45f31eea37e639a1979a963b';

function buildMapHtml(departure, destination, estimatedFare, capacity) {
  const farePerPerson = estimatedFare > 0 && capacity > 0
    ? Math.ceil(estimatedFare / capacity)
    : 0;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #map { width: 100%; height: 100%; }
    #loading {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.95);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; z-index: 999;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 4px solid #E5E7EB;
      border-top: 4px solid #2563EB;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading-text { font-size: 14px; color: #374151; }
    #fare-card {
      display: none;
      position: absolute; bottom: 20px; left: 16px; right: 16px;
      background: white; border-radius: 16px; padding: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 100;
    }
    .route-title {
      font-size: 15px; font-weight: 700; color: #111827;
      margin-bottom: 10px; line-height: 1.4;
    }
    .row { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
    .label { font-size: 12px; color: #9CA3AF; }
    .value { font-size: 12px; font-weight: 600; color: #374151; }
    .fare-value { font-size: 15px; font-weight: 700; color: #059669; }
    .divider { height: 1px; background: #F3F4F6; margin: 8px 0; }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <span id="loading-text">경로를 검색하는 중...</span>
  </div>
  <div id="map"></div>
  <div id="fare-card">
    <div class="route-title" id="route-title"></div>
    <div class="divider"></div>
    <div class="row">
      <span class="label">예상 1인 부담</span>
      <span class="fare-value" id="fare-per-person">${farePerPerson > 0 ? '약 ' + farePerPerson.toLocaleString('ko-KR') + '원' : '미정'}</span>
    </div>
    <div class="row" id="row-distance" style="display:none">
      <span class="label">거리</span>
      <span class="value" id="val-distance"></span>
    </div>
    <div class="row" id="row-duration" style="display:none">
      <span class="label">예상 시간</span>
      <span class="value" id="val-duration"></span>
    </div>
  </div>

  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services"></script>
  <script>
    var DEP  = ${JSON.stringify(departure)};
    var DEST = ${JSON.stringify(destination)};
    var REST_KEY = '${KAKAO_REST_KEY}';

    var map = new kakao.maps.Map(document.getElementById('map'), {
      center: new kakao.maps.LatLng(37.8, 127.1),
      level: 7
    });

    var ps = new kakao.maps.services.Places();

    function searchPlace(query, cb) {
      ps.keywordSearch(query, function(result, status) {
        if (status === kakao.maps.services.Status.OK && result.length > 0) {
          cb({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
        } else {
          cb(null);
        }
      });
    }

    function addMarkerLabel(pos, text, bgColor) {
      new kakao.maps.Marker({ position: pos, map: map });
      new kakao.maps.CustomOverlay({
        position: pos,
        map: map,
        yAnchor: 2.6,
        content: '<div style="background:' + bgColor + ';color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25)">' + text + '</div>'
      });
    }

    function drawNaviRoute(depLat, depLng, destLat, destLng) {
      var url = 'https://apis-navi.kakao.com/v1/directions'
        + '?origin=' + depLng + ',' + depLat
        + '&destination=' + destLng + ',' + destLat
        + '&priority=RECOMMEND';

      fetch(url, { headers: { 'Authorization': 'KakaoAK ' + REST_KEY } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.routes || !data.routes[0] || data.routes[0].result_code !== 0) {
            drawDash(depLat, depLng, destLat, destLng);
            return;
          }
          var summary = data.routes[0].summary;
          document.getElementById('row-distance').style.display = 'flex';
          document.getElementById('row-duration').style.display = 'flex';
          document.getElementById('val-distance').innerText = (summary.distance / 1000).toFixed(1) + ' km';
          document.getElementById('val-duration').innerText = Math.ceil(summary.duration / 60) + ' 분';

          var path = [];
          var bounds = new kakao.maps.LatLngBounds();
          data.routes[0].sections.forEach(function(sec) {
            sec.roads.forEach(function(road) {
              var v = road.vertexes;
              for (var i = 0; i < v.length - 1; i += 2) {
                var latlng = new kakao.maps.LatLng(v[i+1], v[i]);
                path.push(latlng);
                bounds.extend(latlng);
              }
            });
          });
          new kakao.maps.Polyline({
            path: path, map: map,
            strokeWeight: 6, strokeColor: '#2563EB',
            strokeOpacity: 0.9, strokeStyle: 'solid'
          });
          map.setBounds(bounds);
        })
        .catch(function() { drawDash(depLat, depLng, destLat, destLng); });
    }

    function drawDash(depLat, depLng, destLat, destLng) {
      new kakao.maps.Polyline({
        path: [
          new kakao.maps.LatLng(depLat, depLng),
          new kakao.maps.LatLng(destLat, destLng)
        ],
        map: map,
        strokeWeight: 5, strokeColor: '#2563EB',
        strokeOpacity: 0.6, strokeStyle: 'dashed'
      });
    }

    searchPlace(DEP, function(dep) {
      if (!dep) {
        document.getElementById('loading-text').innerText = '출발지를 찾을 수 없어요';
        return;
      }
      searchPlace(DEST, function(dest) {
        if (!dest) {
          document.getElementById('loading-text').innerText = '목적지를 찾을 수 없어요';
          return;
        }

        var depLatLng  = new kakao.maps.LatLng(dep.lat, dep.lng);
        var destLatLng = new kakao.maps.LatLng(dest.lat, dest.lng);

        addMarkerLabel(depLatLng,  '출발 · ' + DEP,  '#2563EB');
        addMarkerLabel(destLatLng, '도착 · ' + DEST, '#EF4444');

        var bounds = new kakao.maps.LatLngBounds();
        bounds.extend(depLatLng);
        bounds.extend(destLatLng);
        map.setBounds(bounds);

        drawNaviRoute(dep.lat, dep.lng, dest.lat, dest.lng);

        document.getElementById('route-title').innerText = DEP + '  →  ' + DEST;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('fare-card').style.display = 'block';
      });
    });
  </script>
</body>
</html>`;
}

export default function KakaoMapScreen({ route }) {
  const { departure, destination, estimatedFare = 0, capacity = 4 } = route.params;
  const webViewRef = useRef(null);
  const html = buildMapHtml(departure, destination, estimatedFare, capacity);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: 'https://kakao.com' }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowUniversalAccessFromFileURLs
        originWhitelist={['*']}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        )}
        onError={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  webview: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
});
