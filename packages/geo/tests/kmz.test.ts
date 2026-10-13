import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { extractKmzKml } from '../src/kmz.js';

const xml = '<kml><Document><Placemark><name>Trilha</name><Point><coordinates>-48,-7</coordinates></Point></Placemark></Document></kml>';
function crc32(data: Uint8Array): number {
  let value=0xffffffff;
  for (const byte of data) { value^=byte; for(let i=0;i<8;i++) value=(value>>>1)^((value&1)?0xedb88320:0); }
  return (value^0xffffffff)>>>0;
}
function zip(name: string, contents = xml, options: {compress?: boolean; badCrc?: boolean; declaredSize?: number} = {}): Blob {
  const filename=Buffer.from(name); const data=Buffer.from(contents);
  const compressed=options.compress===false?data:deflateRawSync(data); const method=options.compress===false?0:8;
  const local=Buffer.alloc(30); local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(method,8);
  local.writeUInt32LE(crc32(data),14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(method,10);
  central.writeUInt32LE(options.badCrc?0:crc32(data),16);central.writeUInt32LE(compressed.length,20);
  central.writeUInt32LE(options.declaredSize??data.length,24);central.writeUInt16LE(filename.length,28);
  const centralAt=local.length+filename.length+compressed.length;
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
  end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(centralAt,16);
  return new Blob([local,filename,compressed,central,filename,end]);
}
describe('KMZ import without networking or ZIP extraction to disk',()=>{
  it('reads bounded deflate-raw doc.kml',async()=>expect(await extractKmzKml(zip('doc.kml'))).toBe(xml));
  it('reads stored KML',async()=>expect(await extractKmzKml(zip('doc.kml',xml,{compress:false}))).toBe(xml));
  it('rejects traversal and CRC mismatches',async()=>{
    await expect(extractKmzKml(zip('../doc.kml'))).rejects.toThrow('caminho');
    await expect(extractKmzKml(zip('doc.kml',xml,{badCrc:true}))).rejects.toThrow('CRC32');
  });
  it('rejects expanded-size deception and invalid ZIP',async()=>{
    await expect(extractKmzKml(zip('doc.kml',xml,{declaredSize:10_000_000}))).rejects.toThrow('excessivo');
    await expect(extractKmzKml(new Blob(['not-a-zip']))).rejects.toThrow('KMZ');
  });
});
