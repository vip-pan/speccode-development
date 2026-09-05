// speccode extension for Pi — minimal skeleton.
//
// 待验证: Pi's extension API is NOT verified against official docs. The
// registration call below is an assumption; check the official extension
// guide and adjust before shipping. The plugin root is this repository
// (repo root = plugin root); shared skills live in ./skills/.
//
// Install (待验证): `pi install git:github.com/vip-pan/speccode`
// Engine shim: `bash scripts/install-shim.sh` from the plugin root.

export default function speccodeExtension(pi) {
  // 待验证: assume a skills-registration surface exists on the extension
  // context. If Pi auto-discovers skills/ (as obra/superpowers' Pi adapter
  // suggests), this extension only needs to surface host-specific notes.
  const pluginRoot = new URL('../..', import.meta.url).pathname;
  if (pi && typeof pi.registerSkills === 'function') {
    pi.registerSkills(`${pluginRoot}skills/`);
  }
  // Host-specific tool mapping lives in references/host-mapping/pi.md.
}
