import type { BundleFile } from "@/types/bundle";

let crcTable: Uint32Array | undefined;

function makeTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  crcTable ??= makeTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = (c >>> 8) ^ crcTable[(c ^ bytes[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const toBytes = (value: string): Uint8Array => encoder.encode(value);
const u16 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
const u32 = (value: number): number[] => [
  value & 0xff,
  (value >> 8) & 0xff,
  (value >> 16) & 0xff,
  (value >> 24) & 0xff,
];

export function makeZip(files: BundleFile[]): Blob {
  const encoded = files.map((file) => {
    const name = toBytes(file.name);
    const data = toBytes(file.content);
    return { name, data, crc: crc32(data) };
  });
  const parts: Uint8Array[] = [];
  const central: Array<{ file: (typeof encoded)[number]; offset: number }> = [];
  let offset = 0;

  encoded.forEach((file) => {
    const header = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(file.crc), ...u32(file.data.length), ...u32(file.data.length),
      ...u16(file.name.length), ...u16(0),
    ]);
    parts.push(header, file.name, file.data);
    central.push({ file, offset });
    offset += header.length + file.name.length + file.data.length;
  });

  const cdStart = offset;
  const cd: Uint8Array[] = [];
  let cdSize = 0;
  central.forEach(({ file, offset: fileOffset }) => {
    const row = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,
      ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(file.crc), ...u32(file.data.length), ...u32(file.data.length),
      ...u16(file.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(fileOffset),
    ]);
    cd.push(row, file.name);
    cdSize += row.length + file.name.length;
  });

  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0), ...u16(0), ...u16(encoded.length), ...u16(encoded.length),
    ...u32(cdSize), ...u32(cdStart), ...u16(0),
  ]);
  // Cast to BlobPart[]: Uint8Array is a valid BlobPart at runtime; the TS 5.7 typed-array
  // generic (ArrayBufferLike vs ArrayBuffer) otherwise rejects it.
  return new Blob([...parts, ...cd, end] as BlobPart[], { type: "application/zip" });
}
