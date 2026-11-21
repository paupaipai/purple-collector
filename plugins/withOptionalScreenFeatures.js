// "orientation": "portrait" hace que Android declare android.hardware.screen.portrait
// como obligatoria, y Play Console bloquea el envio porque excluye tablets/escritorio/XR.
// La marcamos opcional: la app sigue fija en vertical, pero se puede instalar en todos.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURES = ['android.hardware.screen.portrait', 'android.hardware.screen.landscape'];

module.exports = function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = (manifest['uses-feature'] || []).filter(
      (f) => !FEATURES.includes(f.$['android:name'])
    );
    for (const name of FEATURES) {
      manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
