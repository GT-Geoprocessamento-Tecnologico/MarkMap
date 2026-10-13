import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ios = fileURLToPath(new URL('../apps/admin/scripts/ensure-ios-location-usage.mjs', import.meta.url));
const android = fileURLToPath(new URL('../apps/admin/scripts/ensure-android-location-permissions.mjs', import.meta.url));
function fixture(text, task) {
  const root = mkdtempSync(join(tmpdir(), 'markmap-native-'));
  const file = join(root, 'native.xml');
  writeFileSync(file, text);
  try { return task(file); } finally { rmSync(root, { recursive: true, force: true }); }
}
const run = (script, path) => execFileSync(process.execPath, [script, path]);
const read = file => readFileSync(file, 'utf8');
const count = (text, fragment) => text.split(fragment).length - 1;
const f = 'android.permission.ACCESS_FINE_LOCATION';
const c = 'android.permission.ACCESS_COARSE_LOCATION';
const loc = 'NSLocationWhenInUseUsageDescription';

test('A35 comments do not grant Android GPS permissions', () => fixture(
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><!-- <uses-permission android:name="'+f+'"/><uses-permission android:name="'+c+'"/> --><application/></manifest>', file => {
    run(android,file);
    const active=read(file).replace(/<!--[\s\S]*?-->/g,'');
    assert.equal(count(active,'android:name="'+f+'"'),1);
    assert.equal(count(active,'android:name="'+c+'"'),1);
}));

test('A35 Android manifest patch is idempotent', () => fixture(
  '<manifest><uses-permission android:name="'+f+'"/><uses-permission android:name="'+c+'"/><application/></manifest>', file => {
    const before=read(file);run(android,file);run(android,file);assert.equal(read(file),before);
}));

test('A35 Android rejects unclosed manifests', () => fixture('<manifest><uses-permission android:name="'+f+'"/>', file => {
  assert.throws(()=>run(android,file));
}));

test('A35 Android ignores unrelated android:name values', () => fixture(
  '<manifest><application android:name="'+f+'"/></manifest>', file => {
    run(android,file);assert.match(read(file),/<uses-permission\s+android:name="android.permission.ACCESS_FINE_LOCATION"/);
}));

test('A36 iOS updates existing wrong permissions and old locale', () => fixture(
  '<plist><dict><key>'+loc+'</key><string>Old</string><key>CFBundleDevelopmentRegion</key><string>en_US</string></dict></plist>',file => {
    run(ios,file);assert.match(read(file),/A MarkMap usa a sua localização/);
    assert.match(read(file),/<string>pt_BR<\/string>/);assert.doesNotMatch(read(file),/en_US|Old|O GeoNexo usa/);
}));

test('A36 iOS adds missing usage strings exactly once', () => fixture('<plist><dict></dict></plist>',file => {
  run(ios,file);const once=read(file);run(ios,file);assert.equal(read(file),once);
  assert.equal(count(once,'<key>'+loc+'</key>'),1);assert.equal(count(once,'<key>CFBundleDevelopmentRegion</key>'),1);
}));

test('A36 iOS accepts space-indented keys without duplication', () => fixture(
  '<plist><dict>  <key>'+loc+'</key> <string>Wrong</string>  <key>CFBundleDevelopmentRegion</key> <string>en_US</string></dict></plist>',file => {
    run(ios,file);assert.equal(count(read(file),'<key>'+loc+'</key>'),1);assert.match(read(file),/pt_BR/);
}));

test('A36 iOS refuses duplicate or non-string usage keys',()=>{
  for (const chunk of ['<key>'+loc+'</key><string>1</string><key>'+loc+'</key><string>2</string>', '<key>'+loc+'</key><true/>'])
    fixture('<plist><dict>'+chunk+'</dict></plist>',file=>{const before=read(file);assert.throws(()=>run(ios,file));assert.equal(read(file),before);});
});

test('A36 iOS refuses malformed XML without writes',()=>fixture('<plist><key>CFBundleName</key></plist>',file=>{
  const before=read(file);assert.throws(()=>run(ios,file));assert.equal(read(file),before);
}));

test('A36 iOS remeasures insertion offset after updating earlier strings',()=>fixture(
  '<plist><dict><key>CFBundleDevelopmentRegion</key><string>en_US</string><key>CFBundleName</key><string>MarkMap</string></dict></plist>',file=>{
    run(ios,file);assert.match(read(file),/<string>pt_BR<\/string>/);
    assert.match(read(file),/<key>NSLocationWhenInUseUsageDescription<\/key>/);
    assert.match(read(file),/<\/dict><\/plist>$/);
}));
