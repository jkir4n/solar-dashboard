const clouds={sunny:'cirrus','clear-night':'cirrus',partlycloudy:'cumulus',cloudy:'stratocumulus',rainy:'nimbostratus',pouring:'nimbostratus',lightning:'cumulonimbus','lightning-rainy':'cumulonimbus',snowy:'altostratus','snowy-rainy':'nimbostratus',hail:'cumulonimbus',fog:'stratus',windy:'cirrus','windy-variant':'stratocumulus',exceptional:'stratus'};
export const cloudArchetypes=['cirrus','cumulus','stratocumulus','nimbostratus','cumulonimbus','altostratus','stratus'];
export function weatherEffects(weather={},sunElevation=-90){
  const condition=weather.condition,known=Object.hasOwn(clouds,condition),wet=['rainy','pouring','lightning-rainy','snowy-rainy','hail'].includes(condition);
  const bearing=((weather.wind_bearing??0)+180)*Math.PI/180;
  return {
    known,cloudType:known?clouds[condition]:null,
    rain:wet&&condition!=='hail',snow:condition==='snowy'||condition==='snowy-rainy',hail:condition==='hail',
    wetness:known&&wet?1:0,fog:condition==='fog'||(weather.visibility!=null&&weather.visibility<5000),
    wind:[Math.sin(bearing)*(weather.wind_speed??0),0,-Math.cos(bearing)*(weather.wind_speed??0)],
    gust:Math.max(0,(weather.wind_gust_speed??weather.wind_speed??0)-(weather.wind_speed??0)),
    lightning:condition==='lightning'||condition==='lightning-rainy',
    rainbow:known&&wet&&sunElevation>0&&sunElevation<42&&(weather.visibility??0)>5000&&(weather.cloud_coverage??100)<95,
    halo:false,aurora:false,meteor:false,
  };
}
