import test from 'node:test';
import assert from 'node:assert/strict';
import { readActiveGenerationAsset } from '../apps/admin/src/lib/storage/region-generation-asset.mjs';

function mockDatabase(packageRows, assetRows) {
  const transactions = [];
  const response = value => {
    const req = { result: undefined, error: null };
    queueMicrotask(() => { req.result = value; req.onsuccess?.(); });
    return req;
  };
  return {
    transactions,
    transaction(storeNames, mode) {
      transactions.push({ storeNames, mode });
      // Copy the object stores as of the read-only transaction starting.
      const data = {packages:new Map(packageRows),assets:new Map(assetRows)};
      return { objectStore(name) { return { get(key) { return response(data[name].get(key)); } }; } };
    },
  };
}
const generation='9b401771-7849-42d1-9961-a07c329e7200';
const regionId='region-1', path='style.json';
const original=new Blob(['good']);
const pkg= {packageId:regionId,state:'active',generation,manifest:{id:regionId}};
const asset= {packageId:generation,path,bytes:original};

test('A19 asset and active generation are fetched in one readonly transaction', async () => {
  const db=mockDatabase([[`${regionId}:${generation}`,pkg]],[[`${generation}:${path}`,asset]]);
  const value=await readActiveGenerationAsset(db,regionId,path,generation);
  assert.equal(value,original);
  assert.deepEqual(db.transactions,[{storeNames:['packages','assets'],mode:'readonly'}]);
});

test('A19 stale generation is rejected even if its assets remain on disk', async () => {
  const db=mockDatabase([[`${regionId}:${generation}`,{...pkg,state:'staged'}]],[[`${generation}:${path}`,asset]]);
  assert.equal(await readActiveGenerationAsset(db,regionId,path,generation),null);
});

test('A19 mismatch in asset owner, asset path or type is rejected', async () => {
  for(const badAsset of [{...asset,packageId:'other'},{...asset,path:'different'},{...asset,bytes:Uint8Array.of(1)}]){
    const db=mockDatabase([[`${regionId}:${generation}`,pkg]],[[`${generation}:${path}`,badAsset]]);
    assert.equal(await readActiveGenerationAsset(db,regionId,path,generation),null);
  }
});

test('A19 removed package, absent asset and invalid input fail closed', async () => {
  assert.equal(await readActiveGenerationAsset(mockDatabase([],[[`${generation}:${path}`,asset]]),regionId,path,generation),null);
  assert.equal(await readActiveGenerationAsset(mockDatabase([[`${regionId}:${generation}`,pkg]],[]),regionId,path,generation),null);
  await assert.rejects(readActiveGenerationAsset(mockDatabase([],[]),regionId,'',generation),/Expected/);
});

test('A19 concurrent activation cannot mix another generation with old assets', async () => {
  // Database's readonly transaction snapshot is captured before a concurrent writer mutates its maps.
  const packages = new Map([[`${regionId}:${generation}`,pkg]]);
  const assets = new Map([[`${generation}:${path}`,asset]]);
  const db=mockDatabase(packages,assets);
  const pending=readActiveGenerationAsset(db,regionId,path,generation);
  packages.set(`${regionId}:${generation}`,{...pkg,state:'staged'});
  assets.set(`${generation}:${path}`,{...asset,bytes:new Blob(['bad'])});
  assert.equal(await pending,original);
  const newer=await readActiveGenerationAsset(db,regionId,path,generation);
  assert.equal(newer,null);
});
