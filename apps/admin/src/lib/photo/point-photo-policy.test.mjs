import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_POINT_PHOTO_STORED_BYTES, isSupportedBackupOriginalMediaType, isPhotoMediaType, validPointPhotoLink, validatePhotoBytes, validatePhotoOriginalMetadata } from './point-photo-policy.mjs';
const id1='11111111-1111-4111-8111-111111111111';
const id2='22222222-2222-4222-8222-222222222222';
const id3='33333333-3333-4333-8333-333333333333';
const record={ mediaType:'image/jpeg', pointPhoto:{ projectId:id1, featureId:id2, layerId:id3 }, bytes:4 };
test('PDF/TIFF antigos e tipos de fotos continuam aceitos no backup',()=> {
  for (const type of ['application/pdf','image/tiff','image/jpeg','image/png','image/webp']) assert.equal(isSupportedBackupOriginalMediaType(type),true);
  assert.equal(isSupportedBackupOriginalMediaType('image/svg+xml'),false);
});
test('fotos requerem link de IDs canônicos isolado por projeto e camada',()=> {
  assert.ok(validPointPhotoLink(record.pointPhoto));
  assert.doesNotThrow(()=>validatePhotoOriginalMetadata(record));
  assert.throws(()=>validatePhotoOriginalMetadata({...record,pointPhoto: {projectId:id1,featureId:id2}}),/vínculo/);
  assert.throws(()=>validatePhotoOriginalMetadata({...record,pointPhoto: {...record.pointPhoto,caption:'extra'}}),/vínculo/);
  assert.throws(()=>validatePhotoOriginalMetadata({...record,pointPhoto: {...record.pointPhoto,projectId:'../../etc'}}),/vínculo/);
});
test('mídia não fotográfica não pode se passar por vínculo de fotografia',()=> {
  assert.doesNotThrow(()=>validatePhotoOriginalMetadata({mediaType:'image/tiff',bytes:123}));
  assert.throws(()=>validatePhotoOriginalMetadata({mediaType:'application/pdf',pointPhoto:record.pointPhoto}),/não fotográfico/);
  assert.equal(isPhotoMediaType('image/svg+xml'),false);
});
test('limite impede fotos grandes que inviabilizariam backup parcial',()=> {
  assert.throws(()=>validatePhotoOriginalMetadata({...record,bytes:MAX_POINT_PHOTO_STORED_BYTES+1}),/limite/);
  assert.throws(()=>validatePhotoBytes('image/jpeg',new Uint8Array(MAX_POINT_PHOTO_STORED_BYTES+1)),/maior/);
});
test('assinaturas JPEG/PNG/WebP são verificadas, sem confiar no nome do arquivo',()=> {
  assert.doesNotThrow(()=>validatePhotoBytes('image/jpeg',new Uint8Array([255,216,255,224,0])));
  assert.doesNotThrow(()=>validatePhotoBytes('image/png',new Uint8Array([137,80,78,71,13,10,26,10,0])));
  const webp=new Uint8Array(15);webp.set(new TextEncoder().encode('RIFF'),0);webp.set(new TextEncoder().encode('WEBP'),8);
  assert.doesNotThrow(()=>validatePhotoBytes('image/webp',webp));
  assert.throws(()=>validatePhotoBytes('image/png',new Uint8Array([255,216,255])),/PNG inválida/);
  assert.throws(()=>validatePhotoBytes('image/jpeg',new Uint8Array([137,80,78,71])),/JPEG inválida/);
  assert.throws(()=>validatePhotoBytes('image/svg+xml',new Uint8Array([1,2,3])),/Foto deve ser/);
});