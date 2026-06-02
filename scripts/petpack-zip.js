const fs = require("node:fs");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32LE(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function assertZip32Size(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label} is too large for a standard petpack zip`);
  }
}

function createPetpackZip(outPath, entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = (1 << 5) | 1;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = fs.readFileSync(entry.path);
    const checksum = crc32(data);
    assertZip32Size(name.length, `Zip entry name ${entry.name}`);
    assertZip32Size(data.length, `Zip entry ${entry.name}`);
    assertZip32Size(offset, `Zip entry offset ${entry.name}`);

    const localHeader = Buffer.concat([
      writeUInt32LE(0x04034b50),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(dosTime),
      writeUInt16LE(dosDate),
      writeUInt32LE(checksum),
      writeUInt32LE(data.length),
      writeUInt32LE(data.length),
      writeUInt16LE(name.length),
      writeUInt16LE(0),
      name
    ]);
    localParts.push(localHeader, data);

    centralParts.push(
      Buffer.concat([
        writeUInt32LE(0x02014b50),
        writeUInt16LE(20),
        writeUInt16LE(20),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt16LE(dosTime),
        writeUInt16LE(dosDate),
        writeUInt32LE(checksum),
        writeUInt32LE(data.length),
        writeUInt32LE(data.length),
        writeUInt16LE(name.length),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt16LE(0),
        writeUInt32LE(0),
        writeUInt32LE(offset),
        name
      ])
    );

    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  assertZip32Size(centralDirectory.length, "Zip central directory");
  assertZip32Size(offset, "Zip central directory offset");
  const end = Buffer.concat([
    writeUInt32LE(0x06054b50),
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(entries.length),
    writeUInt16LE(entries.length),
    writeUInt32LE(centralDirectory.length),
    writeUInt32LE(offset),
    writeUInt16LE(0)
  ]);

  fs.writeFileSync(outPath, Buffer.concat([...localParts, centralDirectory, end]));
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let index = 0; index < 8; index += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

module.exports = {
  createPetpackZip,
  crc32
};
