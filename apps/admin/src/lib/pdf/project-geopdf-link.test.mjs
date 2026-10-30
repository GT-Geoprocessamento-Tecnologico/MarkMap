import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertGeoPdfProjectIds, assignedProjectGeoPdf, reassignProjectGeoPdf } from './project-geopdf-link.mjs';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
test('project PDF can be linked, switched and cleared preserving original bytes and other projects',()=>{
 const original=[
  {blobId:'a',mediaType:'application/pdf',originalBytes:new Uint8Array([1]),projectGeoPdfIds:[B]},
  {blobId:'b',mediaType:'application/pdf',originalBytes:new Uint8Array([2])},
  {blobId:'photo',mediaType:'image/jpeg'}];
 const linked=reassignProjectGeoPdf(original,A,'a');
 assert.equal(assignedProjectGeoPdf(linked,A)?.blobId,'a');
 assert.deepEqual(linked[0].projectGeoPdfIds,[B,A]);
 const switched=reassignProjectGeoPdf(linked,A,'b');
 assert.equal(assignedProjectGeoPdf(switched,B)?.blobId,'a');
 assert.equal(assignedProjectGeoPdf(switched,A)?.blobId,'b');
 assert.equal(switched[0].originalBytes,original[0].originalBytes);
 assert.equal(switched[2],original[2]);
 assert.equal(assignedProjectGeoPdf(reassignProjectGeoPdf(switched,A,null),A),null);
 assert.deepEqual(original[0].projectGeoPdfIds,[B]);
});
test('invalid association, missing PDF and duplicate projects are rejected',()=>{
 assert.throws(()=>reassignProjectGeoPdf([],'invalid',null),/Projeto/);
 assert.throws(()=>reassignProjectGeoPdf([{blobId:'p',mediaType:'image/png'}],A,'p'),/não encontrado/);
 assert.throws(()=>assertGeoPdfProjectIds([A,A]),/inválidas/);
 assert.throws(()=>reassignProjectGeoPdf([{blobId:'a',mediaType:'application/pdf',projectGeoPdfIds:['bad']}],A,'a'),/inválidas/);
 assert.equal(assignedProjectGeoPdf(reassignProjectGeoPdf([{blobId:'a',mediaType:'application/pdf'}],A,'a'),A)?.blobId,'a');
});
